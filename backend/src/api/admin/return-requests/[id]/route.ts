import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { RETURNS_MODULE } from "../../../../modules/returns"
import { ordersById } from "../route"

/** GET /admin/return-requests/:id — everything staff need to decide and act. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const request = await (req.scope.resolve(RETURNS_MODULE) as any).retrieveReturnRequest(req.params.id).catch(() => null)
  if (!request) return res.status(404).json({ type: "not_found", message: "Return request not found" })
  const order = (await ordersById(req, [request.order_id])).get(request.order_id)
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["items.id", "items.product_title", "items.variant_title", "items.thumbnail", "items.quantity", "items.unit_price"],
    filters: { id: request.order_id },
  })
  const lines = new Map(((data[0] as any)?.items ?? []).map((i: any) => [i.id, i]))
  const variantIds = (request.items as any[]).map((i) => i.exchange_variant_id).filter(Boolean)
  const { data: variants } = variantIds.length
    ? await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: "variant", fields: ["id", "title"], filters: { id: variantIds } })
    : { data: [] as any[] }
  const variantTitle = new Map((variants as any[]).map((v) => [v.id, v.title]))
  // Includes the customer's refund account (COD returns): admin users only
  res.setHeader("cache-control", "private, no-store")
  res.json({
    return_request: {
      ...request,
      order_number: order?.display_id,
      customer: order?.customer?.first_name || order?.shipping_address?.first_name || "",
      customer_phone: order?.customer?.phone ?? null,
      items: (request.items as any[]).map((i) => {
        const li: any = lines.get(i.line_item_id)
        return {
          ...i,
          title: li?.product_title,
          variant_title: li?.variant_title,
          thumbnail: li?.thumbnail,
          exchange_variant_title: i.exchange_variant_id ? variantTitle.get(i.exchange_variant_id) : undefined,
        }
      }),
    },
  })
}
