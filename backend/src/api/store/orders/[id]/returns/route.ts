import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { notifyReturn } from "../../../../../notifications/returns"
import {
  ACCOUNT_NUMBER,
  eligibility,
  IFSC,
  PHOTO_REASONS,
  RefundDetails,
  RequestItem,
  UPI_ID,
} from "../../../../../lib/returns"
import { RETURNS_MODULE } from "../../../../../modules/returns"

/** What the customer sees about a request (no refund details, no internal ids). */
export function publicRequest(r: any) {
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    items: r.items,
    photos: r.photos ?? [],
    refund_amount: r.refund_amount,
    reject_reason: r.reject_reason,
    pickup: r.pickup ? { awb: r.pickup.awb, courier: r.pickup.courier, tracking_url: r.pickup.tracking_url } : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

/** GET /store/orders/:id/returns — what can be returned or exchanged, and earlier requests. */
/**
 * The photo's permanent address. On S3 the file module hands out links that expire after an
 * hour, so the bucket's public address is used instead (S3_FILE_URL, as in medusa-config.ts).
 */
function lastingFileUrl(key: string, url: string): string {
  if (!process.env.S3_BUCKET || !process.env.S3_FILE_URL) return url
  return `${process.env.S3_FILE_URL}/${key.split("/").map(encodeURIComponent).join("/")}`
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const info = await eligibility(req.scope, req.params.id, req.auth_context.actor_id)
  if (!info) {
    return res.status(404).json({ type: "not_found", message: "Order not found" })
  }
  const requests = await (req.scope.resolve(RETURNS_MODULE) as any).listReturnRequests(
    { order_id: info.order.id },
    { order: { created_at: "DESC" } }
  )
  res.setHeader("cache-control", "private, no-store")
  res.json({
    open: info.open,
    window_ends_at: info.window_ends_at,
    cod: info.order.cod,
    items: info.items,
    requests: requests.map(publicRequest),
  })
}

export type CreateReturnBody = {
  type: "return" | "exchange"
  items: RequestItem[]
  photos?: string[]
  refund?: RefundDetails
}

/** POST /store/orders/:id/returns — asks to return items (refund) or exchange them for another size. */
export const POST = async (req: AuthenticatedMedusaRequest<CreateReturnBody>, res: MedusaResponse) => {
  const body = req.validatedBody
  const info = await eligibility(req.scope, req.params.id, req.auth_context.actor_id)
  if (!info) {
    return res.status(404).json({ type: "not_found", message: "Order not found" })
  }
  const fail = (type: string, message: string) => res.status(400).json({ type, message })
  if (!info.open) return fail("window_closed", "This order can no longer be returned or exchanged")

  const seen = new Set<string>()
  for (const item of body.items) {
    const allowed = info.items.find((i) => i.line_item_id === item.line_item_id)
    if (!allowed || !allowed.returnable || seen.has(item.line_item_id)) return fail("not_returnable", "This item cannot be returned")
    seen.add(item.line_item_id)
    if (item.quantity > allowed.quantity) return fail("too_many", "More pieces than can be returned")
    if (body.type === "exchange") {
      const option = allowed.exchange_options.find((o) => o.variant_id === item.exchange_variant_id)
      if (!option || !option.in_stock) return fail("size_unavailable", "That size is not available")
    } else if (item.exchange_variant_id) {
      return fail("invalid_data", "A return has no new size")
    }
  }

  // Photos: only files uploaded through POST /store/returns/photos
  const photos: string[] = []
  const files = req.scope.resolve(Modules.FILE)
  for (const id of body.photos ?? []) {
    const file = await files.retrieveFile(id).catch(() => null)
    if (!id.startsWith(`returns/${req.auth_context.actor_id}/`) || !file?.url) return fail("invalid_photo", "Photo not found")
    photos.push(lastingFileUrl(id, file.url))
  }
  if (body.items.some((i) => PHOTO_REASONS.includes(i.reason)) && !photos.length) {
    return fail("photo_required", "Add a photo of the damaged or wrong item")
  }

  // Refunds of cash-on-delivery orders go to the customer's UPI or bank account
  let refund: RefundDetails | null = null
  if (body.type === "return" && info.order.cod) {
    const r = body.refund
    const valid =
      (r?.method === "upi" && UPI_ID.test(r.upi_id)) ||
      (r?.method === "bank" && ACCOUNT_NUMBER.test(r.account_number) && IFSC.test(r.ifsc) && r.account_name.trim().length >= 2)
    if (!valid) return fail("refund_details", "Enter a valid UPI ID or bank account for the refund")
    refund = r!.method === "upi" ? { method: "upi", upi_id: r!.upi_id.trim() } : { ...r!, account_name: r!.account_name.trim() }
  }

  const returns = req.scope.resolve(RETURNS_MODULE) as any
  const request = await returns.createReturnRequests({
    order_id: info.order.id,
    customer_id: info.order.customer_id,
    type: body.type,
    items: body.items.map((i) => ({
      line_item_id: i.line_item_id,
      quantity: i.quantity,
      unit_paid: info.items.find((e) => e.line_item_id === i.line_item_id)!.unit_paid,
      reason: i.reason,
      note: i.note?.trim().slice(0, 500) || undefined,
      exchange_variant_id: body.type === "exchange" ? i.exchange_variant_id : undefined,
    })),
    photos,
    refund_details: refund,
    refund_amount:
      body.type === "return"
        ? Math.round(body.items.reduce((sum, i) => sum + i.quantity * info.items.find((e) => e.line_item_id === i.line_item_id)!.unit_paid, 0) * 100) / 100
        : null,
    locale: info.order.locale,
  })
  await notifyReturn(req.scope, request.id, "requested").catch(() => {})
  res.json({ request: publicRequest(request) })
}

