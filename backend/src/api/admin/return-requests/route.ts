import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { maskRefundDetails } from "../../../lib/returns"
import { RETURNS_MODULE } from "../../../modules/returns"

/** Order number and customer name for a list of requests. */
export async function ordersById(req: MedusaRequest, orderIds: string[]) {
  if (!orderIds.length) return new Map<string, any>()
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id", "customer.first_name", "customer.last_name", "customer.phone", "shipping_address.first_name"],
    filters: { id: orderIds },
  })
  return new Map((data as any[]).map((o) => [o.id, o]))
}

/** GET /admin/return-requests?status=requested — newest first. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status.split(",") : undefined
  const [requests, count] = await (req.scope.resolve(RETURNS_MODULE) as any).listAndCountReturnRequests(
    status ? { status } : {},
    { order: { created_at: "DESC" }, take: Math.min(Number(req.query.limit) || 50, 200), skip: Number(req.query.offset) || 0 }
  )
  const orders = await ordersById(req, [...new Set<string>(requests.map((r: any) => r.order_id))])
  res.json({
    count,
    return_requests: requests.map((r: any) => {
      const o = orders.get(r.order_id)
      return {
        id: r.id,
        type: r.type,
        status: r.status,
        order_id: r.order_id,
        order_number: o?.display_id,
        customer: o?.customer?.first_name || o?.shipping_address?.first_name || "",
        pieces: (r.items as any[]).reduce((n, i) => n + i.quantity, 0),
        refund_amount: r.refund_amount,
        refund_to: r.refund_details ? maskRefundDetails(r.refund_details) : null,
        created_at: r.created_at,
      }
    }),
  })
}
