import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SHOP } from "../config/shop"
import { COD_PROVIDER_ID } from "./payment-ids"

// What a customer may send back from an order, and until when.
// Rules: delivered orders only, within SHOP.returnWindowDays of delivery;
// products with metadata.returnable false (or "false") are excluded; an item can only
// be in one open (or completed) request at a time; one exchange per item.

export const RETURN_REASONS = ["too_small", "too_large", "damaged", "wrong_item", "not_as_shown", "changed_mind", "other"] as const
export type ReturnReason = (typeof RETURN_REASONS)[number]
/** Reasons that need a photo */
export const PHOTO_REASONS: ReturnReason[] = ["damaged", "wrong_item"]

/** Requests in these states hold their items (others were rejected or cancelled). */
export const ACTIVE_STATUSES = ["requested", "approved", "picked_up", "received", "refund_due", "refunded", "completed"]

export type RequestItem = {
  line_item_id: string
  quantity: number
  /** Paid per piece (after discounts), saved when the request is made */
  unit_paid?: number
  reason: ReturnReason
  note?: string
  exchange_variant_id?: string
}

export type ExchangeOption = { variant_id: string; size: string; in_stock: boolean }

export type EligibleItem = {
  line_item_id: string
  title: string
  variant_title: string | null
  thumbnail: string | null
  /** How many can still be returned */
  quantity: number
  /** Paid per piece, after discounts */
  unit_paid: number
  returnable: boolean
  /** Why not: "not_returnable" | "already_requested" | "exchange_item" */
  reason?: string
  exchange_options: ExchangeOption[]
}

export type Eligibility = {
  order: { id: string; display_id: number; customer_id: string; cod: boolean; locale: string | null; email: string | null }
  delivered_at: string | null
  window_ends_at: string | null
  open: boolean
  items: EligibleItem[]
}

const DAY = 24 * 60 * 60 * 1000

/** Latest delivery time of the order's (not cancelled) parcels, or null if none delivered yet. */
export function deliveredAt(fulfillments: { delivered_at?: string | Date | null; canceled_at?: string | Date | null }[]): Date | null {
  const times = fulfillments.filter((f) => f.delivered_at && !f.canceled_at).map((f) => new Date(f.delivered_at!).getTime())
  return times.length ? new Date(Math.max(...times)) : null
}

export function windowEnds(delivered: Date): Date {
  return new Date(delivered.getTime() + SHOP.returnWindowDays * DAY)
}

/** Size option value of a variant ("Size" option), if any. */
function sizeOf(variant: any): string {
  const opt = (variant.options ?? []).find((o: any) => /size/i.test(o.option?.title ?? ""))
  return opt?.value ?? variant.title ?? ""
}
function colourOf(variant: any): string | undefined {
  return (variant.options ?? []).find((o: any) => /colou?r/i.test(o.option?.title ?? ""))?.value
}

/**
 * Items of an order that its customer may return or exchange now, with the
 * sizes available for an exchange. Null when the order is not the customer's.
 */
export async function eligibility(scope: MedusaContainer, orderId: string, customerId: string, now = new Date()): Promise<Eligibility | null> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "status",
      "customer_id",
      "email",
      "locale",
      "items.*",
      "items.total",
      "items.variant.id",
      "items.variant.options.value",
      "items.variant.options.option.title",
      "items.variant.product.id",
      "items.variant.product.metadata",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
      "payment_collections.payments.provider_id",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as any
  if (!order || order.customer_id !== customerId) return null

  const delivered = deliveredAt(order.fulfillments ?? [])
  const ends = delivered ? windowEnds(delivered) : null
  const open = order.status !== "canceled" && !!ends && now <= ends

  // Items already in requests
  const returns = scope.resolve("returns") as any
  const requests = await returns.listReturnRequests({ order_id: orderId, status: ACTIVE_STATUSES })
  const taken = new Map<string, number>()
  for (const r of requests) for (const i of r.items as RequestItem[]) taken.set(i.line_item_id, (taken.get(i.line_item_id) ?? 0) + i.quantity)
  // Items that arrived through an exchange cannot be exchanged again
  const exchangeItems = new Set<string>(
    (order.items ?? []).filter((i: any) => i.metadata?.from_exchange || i.metadata?.return_request_id).map((i: any) => i.id)
  )

  // Other sizes of the same products (read separately: too deep for one query)
  const productIds = [...new Set<string>((order.items ?? []).map((i: any) => i.variant?.product?.id).filter(Boolean))]
  const { data: products } = productIds.length
    ? await query.graph({
        entity: "product",
        fields: ["id", "variants.id", "variants.title", "variants.options.value", "variants.options.option.title"],
        filters: { id: productIds },
      })
    : { data: [] as any[] }
  const variantsOf = new Map<string, any[]>((products as any[]).map((p) => [p.id, p.variants ?? []]))

  // Stock for exchange sizes
  const variantIds = new Set<string>()
  for (const variants of variantsOf.values()) for (const v of variants) variantIds.add(v.id)
  const stock = new Map<string, number>()
  if (variantIds.size) {
    const { data: levels } = await query.graph({
      entity: "variant",
      fields: ["id", "manage_inventory", "inventory_items.inventory.location_levels.available_quantity"],
      filters: { id: [...variantIds] },
    })
    for (const v of levels as any[]) {
      const available = (v.inventory_items ?? []).flatMap((ii: any) => ii.inventory?.location_levels ?? [])
        .reduce((sum: number, l: any) => sum + Number(l.available_quantity ?? 0), 0)
      stock.set(v.id, v.manage_inventory === false ? Infinity : available)
    }
  }

  const items: EligibleItem[] = (order.items ?? []).map((item: any) => {
    const ordered = Number(item.quantity)
    const left = Math.max(0, ordered - (taken.get(item.id) ?? 0))
    const product = item.variant?.product
    const colour = item.variant ? colourOf(item.variant) : undefined
    const exchange_options: ExchangeOption[] = (variantsOf.get(product?.id) ?? [])
      .filter((v: any) => v.id !== item.variant_id && colourOf(v) === colour)
      .map((v: any) => ({ variant_id: v.id, size: sizeOf(v), in_stock: (stock.get(v.id) ?? 0) > 0 }))
    // The admin metadata editor may save "false" as text
    const notReturnable = [false, "false"].includes(product?.metadata?.returnable)
    return {
      line_item_id: item.id,
      title: item.product_title ?? item.title,
      variant_title: item.variant_title ?? null,
      thumbnail: item.thumbnail ?? null,
      quantity: left,
      unit_paid: Math.round((Number(item.total ?? Number(item.unit_price) * ordered) / ordered) * 100) / 100,
      returnable: open && !notReturnable && left > 0 && !exchangeItems.has(item.id),
      reason: notReturnable ? "not_returnable" : exchangeItems.has(item.id) ? "exchange_item" : left === 0 ? "already_requested" : undefined,
      exchange_options,
    }
  })

  const providers: string[] = (order.payment_collections ?? []).flatMap((c: any) => (c.payments ?? []).map((p: any) => p.provider_id))
  return {
    order: {
      id: order.id,
      display_id: order.display_id,
      customer_id: order.customer_id,
      cod: providers.includes(COD_PROVIDER_ID),
      locale: order.locale ?? null,
      email: order.email ?? null,
    },
    delivered_at: delivered?.toISOString() ?? null,
    window_ends_at: ends?.toISOString() ?? null,
    open,
    items,
  }
}

export type RefundDetails =
  | { method: "upi"; upi_id: string }
  | { method: "bank"; account_name: string; account_number: string; ifsc: string }

export const UPI_ID = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/
export const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/
export const ACCOUNT_NUMBER = /^\d{9,18}$/

/** Shows only the end of refund details (for lists and logs). */
export function maskRefundDetails(d: RefundDetails | null | undefined): string {
  if (!d) return ""
  if (d.method === "upi") return `UPI ${d.upi_id.replace(/^(.{2}).*(@.*)$/, "$1••••$2")}`
  return `Bank ••••${d.account_number.slice(-4)} (${d.ifsc})`
}
