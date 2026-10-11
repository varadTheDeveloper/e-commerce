import { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { SHOP } from "../../../config/shop"
import { OtpState } from "../../../lib/otp"
import { deliveryEstimate } from "../../../lib/shiprocket"

export type CodCart = {
  id: string
  total: number
  currency_code: string
  payment_collection_id: string | null
}

export type CodCheck =
  | { ok: true; cart: CodCart; phone: string; recentlyVerified: boolean }
  | { ok: false; status: number; type: string; message: string }

/**
 * A customer who confirmed their phone by SMS this recently (usually by logging
 * in at checkout) needs no second code for cash on delivery.
 */
export const COD_RECENT_VERIFICATION_MS = 10 * 60 * 1000

/**
 * Checks that the logged-in customer may pay this cart by cash on delivery:
 * their own open cart, with a delivery address and method, within the COD
 * limit. Returns the phone number they logged in with (verified by SMS),
 * and whether it was verified in the last few minutes.
 */
export async function checkCodCart(req: AuthenticatedMedusaRequest, cartId: string): Promise<CodCheck> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "customer_id",
      "completed_at",
      "currency_code",
      "total",
      "items.id",
      "shipping_address.id",
      "shipping_address.postal_code",
      "shipping_methods.id",
      "payment_collection.id",
    ],
    filters: { id: cartId },
  })
  const cart = data[0] as any
  if (!cart || cart.customer_id !== req.auth_context.actor_id || cart.completed_at) {
    return { ok: false, status: 404, type: "not_found", message: "Cart not found" }
  }
  if (!cart.items?.length || !cart.shipping_address || !cart.shipping_methods?.length) {
    return { ok: false, status: 400, type: "not_ready", message: "Add a delivery address first" }
  }
  const total = Number(cart.total)
  if (total > SHOP.codMaxOrder) {
    return { ok: false, status: 400, type: "cod_limit", message: `Cash on delivery is available up to ₹${SHOP.codMaxOrder}` }
  }

  const estimate = await deliveryEstimate(String(cart.shipping_address.postal_code ?? "")).catch(() => null)
  if (estimate?.checked && !estimate.cod) {
    return { ok: false, status: 400, type: "cod_unavailable", message: "Cash on delivery is not available for this pincode" }
  }

  // The number the customer logged in with
  const auth = req.scope.resolve(Modules.AUTH)
  const identity = await auth.retrieveAuthIdentity(req.auth_context.auth_identity_id, { relations: ["provider_identities"] })
  const login = identity.provider_identities?.find((p) => p.provider === "phone-otp")
  const phone = login?.entity_id
  if (!phone) {
    return { ok: false, status: 400, type: "no_phone", message: "Log in with your mobile number to use cash on delivery" }
  }
  const verifiedAt = Number((login?.provider_metadata as OtpState | undefined)?.verified_at ?? 0)
  return {
    ok: true,
    phone,
    recentlyVerified: Date.now() - verifiedAt < COD_RECENT_VERIFICATION_MS,
    cart: { id: cart.id, total, currency_code: cart.currency_code, payment_collection_id: cart.payment_collection?.id ?? null },
  }
}
