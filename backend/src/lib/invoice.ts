import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SELLER } from "../config/seller"
import { financialYear, GST_STATE_CODES, gstSummary } from "./gst"
import { InvoiceData, InvoiceParty } from "./invoice-pdf"
import { COD_PROVIDER_ID } from "./payment-ids"

const DEFAULT_HSN = "6211"

export function invoiceNumber(displayId: number, createdAt: Date): string {
  return `${SELLER.invoicePrefix}/${financialYear(createdAt)}/${String(displayId).padStart(6, "0")}`
}

function party(a: any, fallbackName: string): InvoiceParty {
  if (!a) return { name: fallbackName, lines: [] }
  return {
    name: [a.first_name, a.last_name].filter(Boolean).join(" ") || fallbackName,
    lines: [a.address_1, a.address_2, [a.city, a.province, a.postal_code].filter(Boolean).join(", ")],
    phone: a.phone,
  }
}

/**
 * Invoice data for an order, or null when the order does not exist or (when
 * `customerId` is given) belongs to someone else.
 */
export async function invoiceForOrder(scope: MedusaContainer, orderId: string, customerId?: string): Promise<InvoiceData | null> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "created_at",
      "customer_id",
      "shipping_total",
      "items.quantity",
      "items.total",
      "items.product_id",
      "items.product_title",
      "items.variant_title",
      "shipping_address.*",
      "billing_address.*",
      "payment_collections.payments.provider_id",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as any
  if (!order || (customerId && order.customer_id !== customerId)) {
    return null
  }

  // English titles and HSN codes from the products (order lines may hold translated titles)
  const productIds = [...new Set((order.items ?? []).map((i: any) => i.product_id).filter(Boolean))] as string[]
  const { data: products } = productIds.length
    ? await query.graph({ entity: "product", fields: ["id", "title", "metadata"], filters: { id: productIds } })
    : { data: [] as any[] }
  const byId = new Map((products as any[]).map((p) => [p.id, p]))

  const items = (order.items ?? []).map((i: any) => {
    const product = byId.get(i.product_id)
    return {
      description: [product?.title ?? i.product_title, i.variant_title].filter(Boolean).join(" — "),
      hsn: String(product?.metadata?.hsn ?? DEFAULT_HSN),
      quantity: Number(i.quantity),
      total: Number(i.total),
    }
  })

  const ship = order.shipping_address
  const buyerState = ship?.province ?? null
  const buyerCode = buyerState ? GST_STATE_CODES[buyerState] ?? null : null
  const createdAt = new Date(order.created_at)
  const providers = (order.payment_collections ?? []).flatMap((c: any) => (c.payments ?? []).map((p: any) => p.provider_id))

  return {
    number: invoiceNumber(order.display_id, createdAt),
    date: createdAt,
    orderNumber: `#${order.display_id}`,
    seller: {
      name: SELLER.legalName,
      lines: [...SELLER.address],
      gstin: SELLER.gstin,
      state: SELLER.state,
      stateCode: SELLER.stateCode,
      email: SELLER.email,
    },
    billTo: party(order.billing_address ?? ship, "Customer"),
    shipTo: party(ship, "Customer"),
    placeOfSupply: buyerState ? `${buyerState}${buyerCode ? ` (${buyerCode})` : ""}` : SELLER.state,
    paymentMethod: providers.includes(COD_PROVIDER_ID) ? "Cash on delivery" : "Paid online",
    gst: gstSummary(items, Number(order.shipping_total ?? 0), SELLER.stateCode, buyerCode),
  }
}
