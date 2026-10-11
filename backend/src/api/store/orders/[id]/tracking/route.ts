import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /store/orders/:id/tracking — delivery progress of the logged-in
 * customer's order (Medusa's own order endpoint does not include it).
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "customer_id", "status", "canceled_at", "metadata"],
    filters: { id: req.params.id },
  })
  const order = data[0] as any
  if (!order || order.customer_id !== req.auth_context.actor_id) {
    return res.status(404).json({ type: "not_found", message: "Order not found" })
  }
  res.setHeader("cache-control", "private, no-store")
  res.json({
    tracking: order.metadata?.tracking ?? null,
    canceled_at: order.canceled_at ?? null,
  })
}
