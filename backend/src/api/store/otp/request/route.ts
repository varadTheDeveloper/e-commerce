import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { generateOtp, hashOtp, OTP_RESEND_AFTER_MS } from "../../../../lib/otp"
import { otpConfig } from "../../../../lib/otp-config"
import { maskPhone, normalizeIndianMobile } from "../../../../lib/phone"
import { RateLimiter } from "../../../../lib/rate-limit"
import { sendOtpSms, smsConfigFromEnv } from "../../../../lib/sms"

// At most 10 code requests per network address per 15 minutes
// (each number also has its own 30-second wait and 5-per-hour cap).
// Test mode (fixed code, never in production) allows more, so automated
// tests can sign up many customers from one machine.
const perIp = new RateLimiter(otpConfig().testCode ? 1000 : 10, 15 * 60 * 1000)

export type OtpRequestBody = { phone: string }

/** POST /store/otp/request { phone } — sends a 6-digit login code by SMS. */
export const POST = async (req: MedusaRequest<OtpRequestBody>, res: MedusaResponse) => {
  const phone = normalizeIndianMobile(req.validatedBody.phone)
  if (!phone) {
    return res.status(400).json({ type: "invalid_data", message: "Enter a valid 10-digit Indian mobile number" })
  }

  const wait = perIp.hit(req.ip ?? "unknown")
  if (wait) {
    return res.status(429).json({ type: "too_many", message: "Too many requests. Try again later.", retry_after: Math.ceil(wait / 1000) })
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const { secret, testCode } = otpConfig()
  const code = testCode ?? generateOtp()

  const auth = req.scope.resolve(Modules.AUTH)
  const result = await auth.updateProvider("phone-otp", { entity_id: phone, code_hash: hashOtp(phone, code, secret) })
  if (!result.success) {
    const [reason, seconds] = String(result.error ?? "").split(":")
    if (reason === "too_soon" || reason === "too_many") {
      return res.status(429).json({
        type: reason,
        message: reason === "too_soon" ? "Please wait before asking for a new code." : "Too many codes for this number. Try again later.",
        retry_after: Number(seconds) || 60,
      })
    }
    return res.status(400).json({ type: "invalid_data", message: "Enter a valid 10-digit Indian mobile number" })
  }

  try {
    await sendOtpSms(phone, code, smsConfigFromEnv(), logger)
  } catch (e) {
    logger.error(`Login code SMS to ${maskPhone(phone)} failed: ${e instanceof Error ? e.message : e}`)
    return res.status(502).json({ type: "sms_failed", message: "Could not send the SMS. Please try again." })
  }

  res.json({ sent: true, resend_after: OTP_RESEND_AFTER_MS / 1000 })
}
