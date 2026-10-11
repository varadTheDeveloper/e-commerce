import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { createPaymentCollectionForCartWorkflow, createPaymentSessionsWorkflow } from "@medusajs/medusa/core-flows"
import { codToken } from "../../../../lib/cod"
import { checkCode } from "../../../../lib/login-code"
import { otpConfig } from "../../../../lib/otp-config"
import { COD_PROVIDER_ID } from "../../../../lib/payment-ids"
import { toPaise } from "../../../../modules/razorpay/service"
import { checkCodCart } from "../helpers"

export type CodConfirmBody = { cart_id: string; code?: string }

/**
 * POST /store/cod/confirm { cart_id, code } — checks the SMS code and sets the
 * cart to pay by cash on delivery. The shop then completes the cart. The code
 * may be left out when the phone was confirmed by SMS in the last few minutes.
 */
export const POST = async (req: AuthenticatedMedusaRequest<CodConfirmBody>, res: MedusaResponse) => {
  const { cart_id, code } = req.validatedBody
  const check = await checkCodCart(req, cart_id)
  if (!check.ok) {
    return res.status(check.status).json({ type: check.type, message: check.message })
  }
  if (!code && !check.recentlyVerified) {
    return res.status(401).json({ type: "wrong_code", message: "Enter the code sent to your phone" })
  }
  const verified = code ? await checkCode(req.scope, check.phone, code) : ({ ok: true } as const)
  if (!verified.ok) {
    const locked = verified.error.startsWith("Too many")
    return res.status(401).json({ type: locked ? "locked" : "wrong_code", message: verified.error })
  }

  let collectionId = check.cart.payment_collection_id
  if (!collectionId) {
    await createPaymentCollectionForCartWorkflow(req.scope).run({ input: { cart_id } })
    const again = await checkCodCart(req, cart_id)
    collectionId = again.ok ? again.cart.payment_collection_id : null
  }
  if (!collectionId) {
    return res.status(409).json({ type: "not_ready", message: "Please try again" })
  }

  const { result: session } = await createPaymentSessionsWorkflow(req.scope).run({
    input: { payment_collection_id: collectionId, provider_id: COD_PROVIDER_ID, customer_id: req.auth_context.actor_id },
  })

  const payment = req.scope.resolve(Modules.PAYMENT)
  const amount = toPaise(session.amount)
  await payment.updatePaymentSession({
    id: session.id,
    amount: session.amount,
    currency_code: session.currency_code,
    data: { ...session.data, session_id: session.id, amount, cod_token: codToken(otpConfig().secret, session.id, amount) },
  })
  res.json({ confirmed: true })
}
