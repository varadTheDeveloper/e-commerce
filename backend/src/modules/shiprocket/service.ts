import {
  CalculatedShippingOptionPrice,
  CreateFulfillmentResult,
  FulfillmentOption,
  Logger,
} from "@medusajs/framework/types"
import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import { SELLER } from "../../config/seller"
import { SHOP } from "../../config/shop"
import { shiprocketFromEnv } from "../../lib/shiprocket"
import { AdhocOrderInput, ShiprocketClient } from "./client"

/** What we keep on a Medusa fulfillment booked with Shiprocket. */
export type ShiprocketFulfillmentData = {
  shiprocket_order_id: number
  shipment_id: number
  /** Order id sent to Shiprocket: <medusa order id>-<suffix> */
  channel_order_id: string
  awb: string
  courier: string
  pickup_requested: boolean
  label_url: string | null
  payment_method: "COD" | "Prepaid"
}

export const trackingUrl = (awb: string) => `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "")

/**
 * Builds the Shiprocket order for a fulfillment. Refuses to guess how the
 * order was paid: a COD parcel booked as prepaid would not be collected.
 */
export function shiprocketOrderFor(order: any, items: { line_item_id?: string; quantity?: unknown }[], suffix: string): AdhocOrderInput {
  const method = order?.metadata?.payment_method
  if (method !== "cod" && method !== "online") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "The order has no payment method recorded; cannot book the courier")
  }
  const a = order.shipping_address ?? {}
  const lines = items.map((fi) => {
    const li = (order.items ?? []).find((i: any) => i.id === fi.line_item_id)
    if (!li) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Fulfillment item not found in the order")
    const units = Number(fi.quantity)
    const lineTotal = Number(li.total ?? Number(li.unit_price) * Number(li.quantity))
    return {
      name: [li.product_title ?? li.title, li.variant_title].filter(Boolean).join(" - ").slice(0, 200),
      sku: String(li.variant_sku ?? li.variant?.sku ?? li.id),
      units,
      selling_price: Math.round((lineTotal / Number(li.quantity)) * 100) / 100,
      hsn: li.variant?.product?.hs_code ?? undefined,
      grams: Number(li.variant?.weight) > 0 ? Number(li.variant.weight) : SHOP.defaultItemGrams,
    }
  })
  const grams = Math.max(
    SHOP.defaultPackage.weightGrams,
    lines.reduce((sum, l) => sum + l.grams * l.units, 0)
  )
  const subTotal = Math.round(lines.reduce((sum, l) => sum + l.selling_price * l.units, 0) * 100) / 100
  const phone = digits(a.phone).slice(-10)
  return {
    order_id: `${order.id}-${suffix}`,
    order_date: new Date(order.created_at ?? Date.now()).toISOString().slice(0, 16).replace("T", " "),
    pickup_location: SELLER.pickupLocation,
    billing_customer_name: String(a.first_name ?? "Customer").slice(0, 60),
    billing_last_name: String(a.last_name ?? "").slice(0, 60),
    billing_address: String(a.address_1 ?? "").slice(0, 190),
    billing_address_2: [a.address_2, (a.metadata as any)?.landmark].filter(Boolean).join(", ").slice(0, 190),
    billing_city: String(a.city ?? ""),
    billing_pincode: String(a.postal_code ?? ""),
    billing_state: String(a.province ?? ""),
    billing_country: "India",
    billing_email: order.email || order.customer?.email || SELLER.email,
    billing_phone: phone,
    shipping_is_billing: true,
    order_items: lines.map(({ grams: _g, ...l }) => l),
    // Exchanges ship after the COD money was collected: nothing to collect then
    payment_method: method === "cod" && !order.metadata?.cod_collected ? "COD" : "Prepaid",
    sub_total: subTotal,
    shipping_charges: Number(order.shipping_total ?? 0),
    length: SHOP.defaultPackage.lengthCm,
    breadth: SHOP.defaultPackage.breadthCm,
    height: SHOP.defaultPackage.heightCm,
    weight: grams / 1000,
  }
}

/**
 * Delivery through Shiprocket. Staff press "Create fulfillment" on an order in
 * the admin once the parcel is packed: this books it with Shiprocket, assigns
 * the recommended courier, requests a pickup and makes the label. Delivery
 * prices are flat (set on the shipping option), not Shiprocket's rates.
 */
class ShiprocketFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "shiprocket"

  protected logger_: Logger

  constructor({ logger }: { logger: Logger }) {
    super()
    this.logger_ = logger
  }

  protected client(): ShiprocketClient {
    const client = shiprocketFromEnv()
    if (!client) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Shiprocket is not set up (SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD)")
    }
    return client
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: "shiprocket-standard" }, { id: "shiprocket-return", is_return: true }]
  }

  async validateFulfillmentData(): Promise<any> {
    // Nothing from the shopper is needed or kept
    return {}
  }

  async validateOption(): Promise<boolean> {
    return true
  }

  async canCalculate(): Promise<boolean> {
    return false
  }

  async calculatePrice(): Promise<CalculatedShippingOptionPrice> {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Delivery prices are flat")
  }

  async createFulfillment(_data: Record<string, unknown>, items: any[], order: any): Promise<CreateFulfillmentResult> {
    const sr = this.client()
    const input = shiprocketOrderFor(order, items, Date.now().toString(36))
    const created = await sr.createOrder(input)

    let awb: { awb: string; courierName: string }
    try {
      awb = await sr.assignAwb(created.shipment_id)
    } catch (e) {
      // Do not leave a half-booked order in Shiprocket
      await sr.cancelOrders([created.order_id]).catch(() => {})
      throw e
    }

    // Pickup and label can be done again from the Shiprocket panel if they fail here
    const pickup = await sr.generatePickup(created.shipment_id).then(
      () => true,
      (e) => {
        this.logger_.warn(`Shiprocket pickup request failed for shipment ${created.shipment_id}: ${e.message}`)
        return false
      }
    )
    const label = await sr.generateLabel(created.shipment_id).catch((e) => {
      this.logger_.warn(`Shiprocket label failed for shipment ${created.shipment_id}: ${e.message}`)
      return null
    })

    const data: ShiprocketFulfillmentData = {
      shiprocket_order_id: created.order_id,
      shipment_id: created.shipment_id,
      channel_order_id: input.order_id,
      awb: awb.awb,
      courier: awb.courierName,
      pickup_requested: pickup,
      label_url: label,
      payment_method: input.payment_method,
    }
    return {
      data: data as unknown as Record<string, unknown>,
      labels: [{ tracking_number: awb.awb, tracking_url: trackingUrl(awb.awb), label_url: label ?? "" }],
    }
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<any> {
    const id = Number((data as Partial<ShiprocketFulfillmentData>)?.shiprocket_order_id)
    if (id) {
      await this.client().cancelOrders([id])
    }
    return {}
  }

  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    // Return pickups are booked by the returns flow (src/lib/return-actions.ts), not here
    return { data: {}, labels: [] }
  }
}

export default ShiprocketFulfillmentService
