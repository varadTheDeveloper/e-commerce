import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendCode } from "../../../../lib/login-code"
import { maskPhone } from "../../../../lib/phone"
import { checkCodCart } from "../helpers"

export type CodRequestBody = { cart_id: string }

/**
 * POST /store/cod/request { cart_id } — sends a code to confirm a cash-on-delivery
 * order, or answers `{ sent: false, verified: true }` when the phone was
 * confirmed by SMS in the last few minutes (no code needed).
 */
export const POST = async (req: AuthenticatedMedusaRequest<CodRequestBody>, res: MedusaResponse) => {
  const check = await checkCodCart(req, req.validatedBody.cart_id)
  if (!check.ok) {
    return res.status(check.status).json({ type: check.type, message: check.message })
  }
  if (check.recentlyVerified) {
    return res.json({ sent: false, verified: true, phone: maskPhone(check.phone) })
  }
  const result = await sendCode(req.scope, check.phone)
  if (!result.ok) {
    return res.status(result.status).json({ type: result.type, message: result.message, retry_after: result.retryAfter })
  }
  res.json({ sent: true, resend_after: result.resendAfter, phone: maskPhone(check.phone) })
}
