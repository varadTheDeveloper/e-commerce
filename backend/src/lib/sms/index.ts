import { Logger } from "@medusajs/framework/types"
import { maskPhone } from "../phone"

// Sends login codes by SMS.
// SMS_PROVIDER=console (development and tests): no SMS, the code is written
//   to the server log. Refused in production by medusa-config.ts.
// SMS_PROVIDER=msg91: MSG91 Flow API with a DLT-approved template whose
//   variable holds the code (MSG91_OTP_VAR, default "otp").
// SMS_PROVIDER=messagecentral: Message Central VerifyNow (no DLT needed).
//   They create the code, send it and check it; we keep only their
//   verification id. See ./messagecentral.ts.

export type SmsProvider = "console" | "msg91" | "messagecentral"

export type SmsConfig = {
  provider: SmsProvider
  msg91AuthKey?: string
  msg91TemplateId?: string
  msg91OtpVar?: string
  messageCentralCustomerId?: string
  messageCentralPassword?: string
  /** Tests only: a fake server. Default https://cpaas.messagecentral.com */
  messageCentralBaseUrl?: string
}

const PROVIDERS: SmsProvider[] = ["console", "msg91", "messagecentral"]

export function smsConfigFromEnv(env = process.env): SmsConfig {
  return {
    provider: PROVIDERS.find((p) => p === env.SMS_PROVIDER) ?? "console",
    msg91AuthKey: env.MSG91_AUTH_KEY,
    msg91TemplateId: env.MSG91_OTP_TEMPLATE_ID,
    msg91OtpVar: env.MSG91_OTP_VAR || "otp",
    messageCentralCustomerId: env.MESSAGECENTRAL_CUSTOMER_ID,
    messageCentralPassword: env.MESSAGECENTRAL_PASSWORD,
    messageCentralBaseUrl: env.MESSAGECENTRAL_BASE_URL || undefined,
  }
}

/** True when the SMS service makes and checks the code itself. */
export function providerMakesCode(config: SmsConfig): boolean {
  return config.provider === "messagecentral"
}

export async function sendOtpSms(
  phone: string,
  code: string,
  config: SmsConfig,
  logger: Logger,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  if (config.provider === "console") {
    logger.info(`[sms:console] login code for ${maskPhone(phone)}: ${code}`)
    return
  }

  if (config.provider !== "msg91") {
    throw new Error(`SMS provider ${config.provider} sends its own codes`)
  }
  if (!config.msg91AuthKey || !config.msg91TemplateId) {
    throw new Error("MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID must be set")
  }
  const res = await fetchImpl("https://control.msg91.com/api/v5/flow", {
    method: "POST",
    headers: { authkey: config.msg91AuthKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      template_id: config.msg91TemplateId,
      short_url: "0",
      recipients: [{ mobiles: phone.replace(/^\+/, ""), [config.msg91OtpVar || "otp"]: code }],
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    // Body may echo the number; log status only
    throw new Error(`MSG91 rejected the SMS (HTTP ${res.status})`)
  }
}
