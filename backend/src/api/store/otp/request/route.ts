import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendCode } from "../../../../lib/login-code"
import { otpConfig } from "../../../../lib/otp-config"
import { normalizeIndianMobile } from "../../../../lib/phone"
import { RateLimiter } from "../../../../lib/rate-limit"

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

  const result = await sendCode(req.scope, phone)
  if (!result.ok) {
    return res.status(result.status).json({ type: result.type, message: result.message, retry_after: result.retryAfter })
  }
  res.json({ sent: true, resend_after: result.resendAfter })
}
