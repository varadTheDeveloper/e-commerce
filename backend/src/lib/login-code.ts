import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { generateOtp, hashOtp, OTP_RESEND_AFTER_MS } from "./otp"
import { otpConfig } from "./otp-config"
import { maskPhone } from "./phone"
import { providerMakesCode, sendOtpSms, smsConfigFromEnv } from "./sms"
import { sendMessageCentralOtp } from "./sms/messagecentral"

export type SendCodeResult =
  | { ok: true; resendAfter: number }
  | { ok: false; status: 400 | 429 | 502; type: string; message: string; retryAfter?: number }

/**
 * Sends a 6-digit code by SMS to a +91 number, through the phone-otp auth
 * provider (which applies the resend wait and hourly cap). Used for login and
 * to confirm cash-on-delivery orders.
 */
export async function sendCode(scope: MedusaContainer, phone: string): Promise<SendCodeResult> {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  const { secret, testCode } = otpConfig()
  const sms = smsConfigFromEnv()
  // Message Central makes the code itself; otherwise we make it here
  const code = providerMakesCode(sms) ? null : testCode ?? generateOtp()

  const auth = scope.resolve(Modules.AUTH)
  const result = await auth.updateProvider("phone-otp", {
    entity_id: phone,
    code_hash: code === null ? null : hashOtp(phone, code, secret),
  })
  if (!result.success) {
    const [reason, seconds] = String(result.error ?? "").split(":")
    if (reason === "too_soon" || reason === "too_many") {
      return {
        ok: false,
        status: 429,
        type: reason,
        message: reason === "too_soon" ? "Please wait before asking for a new code." : "Too many codes for this number. Try again later.",
        retryAfter: Number(seconds) || 60,
      }
    }
    return { ok: false, status: 400, type: "invalid_data", message: "Enter a valid 10-digit Indian mobile number" }
  }

  try {
    if (code === null) {
      const ref = await sendMessageCentralOtp(phone, sms)
      const saved = await auth.updateProvider("phone-otp", { entity_id: phone, provider_ref: ref })
      if (!saved.success) {
        throw new Error(String(saved.error))
      }
    } else {
      await sendOtpSms(phone, code, sms, logger)
    }
  } catch (e) {
    logger.error(`Code SMS to ${maskPhone(phone)} failed: ${e instanceof Error ? e.message : e}`)
    return { ok: false, status: 502, type: "sms_failed", message: "Could not send the SMS. Please try again." }
  }
  return { ok: true, resendAfter: OTP_RESEND_AFTER_MS / 1000 }
}

/** Checks a code sent with sendCode. Wrong tries count towards the same lock-out as login. */
export async function checkCode(scope: MedusaContainer, phone: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = scope.resolve(Modules.AUTH)
  const result = await auth.authenticate("phone-otp", { body: { phone, code } } as any)
  return result.success ? { ok: true } : { ok: false, error: result.error ?? "Invalid or expired code" }
}
