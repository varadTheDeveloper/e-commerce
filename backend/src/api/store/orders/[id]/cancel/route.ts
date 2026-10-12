import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { cancelOrderFulfillmentWorkflow, cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { CancelReason } from "../../../../../lib/cancel"

export type CancelBody = { reason: CancelReason }

/**
 * POST /store/orders/:id/cancel { reason } — the customer cancels their own
 * order before it is shipped. A courier booking is cancelled with Shiprocket
 * first; Medusa then refunds online payments (through Razorpay) and puts the
 * stock back.
 */
export const POST = async (req: AuthenticatedMedusaRequest<CancelBody>, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "status", "customer_id", "metadata", "fulfillments.id", "fulfillments.shipped_at", "fulfillments.canceled_at"],
    filters: { id: req.params.id },
  })
  const order = data[0] as any
  if (!order || order.customer_id !== req.auth_context.actor_id) {
    return res.status(404).json({ type: "not_found", message: "Order not found" })
  }
  if (order.status === "canceled") {
    return res.json({ canceled: true })
  }
  const open = (order.fulfillments ?? []).filter((f: any) => !f.canceled_at)
  if (order.status === "completed" || open.some((f: any) => f.shipped_at)) {
    return res.status(409).json({ type: "already_shipped", message: "This order has already been shipped and can no longer be cancelled" })
  }

  try {
    for (const f of open) {
      await cancelOrderFulfillmentWorkflow(req.scope).run({ input: { order_id: order.id, fulfillment_id: f.id } })
    }
  } catch {
    // Shiprocket refuses once the courier has picked the parcel up
    return res.status(409).json({ type: "already_shipped", message: "This order has already been shipped and can no longer be cancelled" })
  }
  await cancelOrderWorkflow(req.scope).run({ input: { order_id: order.id, canceled_by: req.auth_context.actor_id } })
  await req.scope.resolve(Modules.ORDER).updateOrders([
    { id: order.id, metadata: { cancel_reason: req.validatedBody.reason, canceled_by_customer: true } },
  ])
  res.json({ canceled: true })
}
