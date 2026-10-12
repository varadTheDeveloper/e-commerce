import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { SELLER } from "../config/seller"
import { SHOP } from "../config/shop"
import { trackingUrl } from "../modules/shiprocket/service"
import { RETURNS_MODULE } from "../modules/returns"
import { SHIPPING_PROVIDER_ID } from "../modules/shiprocket/ids"
import { notifyReturn } from "../notifications/returns"
import { receiveMedusaReturn, startMedusaExchange, startMedusaReturn } from "./medusa-returns"
import { RAZORPAY_PROVIDER_ID } from "./payment-ids"
import { maskRefundDetails, RequestItem } from "./returns"
import { shiprocketFromEnv } from "./shiprocket"

// What staff do with a return or exchange request (admin routes call these).

const returns = (scope: MedusaContainer) => scope.resolve(RETURNS_MODULE) as any

async function load(scope: MedusaContainer, id: string) {
  const request = await returns(scope).retrieveReturnRequest(id).catch(() => null)
  if (!request) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Return request not found")
  return request
}

function requireStatus(request: any, allowed: string[]) {
  if (!allowed.includes(request.status)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `This request is ${request.status.replace("_", " ")}`)
  }
}

async function orderFor(scope: MedusaContainer, orderId: string) {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "items.*",
      "items.variant.weight",
      "items.variant.product.hs_code",
      "shipping_address.*",
      "customer.email",
      "payment_collections.payments.id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
    ],
    filters: { id: orderId },
  })
  return data[0] as any
}

/** Books a Shiprocket courier to collect the items from the customer and bring them to the warehouse. */
async function bookPickup(order: any, request: any) {
  const sr = shiprocketFromEnv()
  if (!sr) return { error: "Shiprocket is not set up: arrange the pickup yourself" }
  const a = order.shipping_address ?? {}
  const w = SELLER.warehouse
  const lines = (request.items as RequestItem[]).map((ri) => {
    const li = order.items.find((i: any) => i.id === ri.line_item_id)
    return {
      name: [li?.product_title ?? li?.title, li?.variant_title].filter(Boolean).join(" - ").slice(0, 200),
      sku: String(li?.variant_sku ?? li?.id),
      units: ri.quantity,
      selling_price: Number(ri.unit_paid ?? li?.unit_price ?? 0),
      hsn: li?.variant?.product?.hs_code ?? undefined,
      grams: (Number(li?.variant?.weight) > 0 ? Number(li.variant.weight) : SHOP.defaultItemGrams) * ri.quantity,
    }
  })
  const phone = String(a.phone ?? "").replace(/\D/g, "").slice(-10)
  try {
    const created = await sr.createReturnOrder({
      order_id: `${request.id}-${Date.now().toString(36)}`,
      order_date: new Date().toISOString().slice(0, 16).replace("T", " "),
      pickup_customer_name: String(a.first_name ?? "Customer").slice(0, 60),
      pickup_last_name: String(a.last_name ?? "").slice(0, 60),
      pickup_address: String(a.address_1 ?? "").slice(0, 190),
      pickup_address_2: [a.address_2, (a.metadata as any)?.landmark].filter(Boolean).join(", ").slice(0, 190),
      pickup_city: String(a.city ?? ""),
      pickup_state: String(a.province ?? ""),
      pickup_country: "India",
      pickup_pincode: String(a.postal_code ?? ""),
      pickup_email: order.email || order.customer?.email || SELLER.email,
      pickup_phone: phone,
      shipping_customer_name: w.name,
      shipping_last_name: "",
      shipping_address: w.address,
      shipping_address_2: "",
      shipping_city: w.city,
      shipping_state: w.state,
      shipping_country: "India",
      shipping_pincode: w.pincode,
      shipping_email: SELLER.email,
      shipping_phone: w.phone,
      order_items: lines.map(({ grams: _g, ...l }) => l),
      payment_method: "PREPAID",
      sub_total: Math.round(lines.reduce((s, l) => s + l.selling_price * l.units, 0) * 100) / 100,
      length: SHOP.defaultPackage.lengthCm,
      breadth: SHOP.defaultPackage.breadthCm,
      height: SHOP.defaultPackage.heightCm,
      weight: Math.max(SHOP.defaultPackage.weightGrams, lines.reduce((s, l) => s + l.grams, 0)) / 1000,
    })
    const awb = await sr.assignAwb(created.shipment_id, undefined, true)
    return {
      shiprocket_order_id: created.order_id,
      shipment_id: created.shipment_id,
      awb: awb.awb,
      courier: awb.courierName,
      tracking_url: trackingUrl(awb.awb),
    }
  } catch (e) {
    return { error: `Pickup not booked: ${e instanceof Error ? e.message : e}` }
  }
}

/**
 * Approves a request: records the return (or exchange, which holds the new
 * size's stock) on the order and books the courier pickup.
 */
export async function approveRequest(scope: MedusaContainer, id: string) {
  const request = await load(scope, id)
  requireStatus(request, ["requested"])
  const order = await orderFor(scope, request.order_id)
  const items = (request.items as RequestItem[]).map((i) => ({ id: i.line_item_id, quantity: i.quantity }))

  let medusa: { medusa_return_id: string; medusa_exchange_id?: string }
  if (request.type === "exchange") {
    const { data: options } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "shipping_option",
      fields: ["id", "provider_id", "rules.attribute", "rules.value"],
    })
    const outbound = (options as any[]).find(
      (o) => o.provider_id === SHIPPING_PROVIDER_ID && !(o.rules ?? []).some((r: any) => r.attribute === "is_return" && r.value === "true")
    )
    if (!outbound) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No delivery option for the new size")
    const { exchangeId, returnId } = await startMedusaExchange(
      scope,
      order.id,
      (request.items as RequestItem[]).map((ri) => {
        const li = order.items.find((i: any) => i.id === ri.line_item_id)
        return {
          id: ri.line_item_id,
          quantity: ri.quantity,
          variant_id: ri.exchange_variant_id!,
          // The new size costs what the customer paid for the old one
          unit_price: Number(ri.unit_paid ?? li?.unit_price),
        }
      }),
      outbound.id,
      id
    )
    medusa = { medusa_return_id: returnId, medusa_exchange_id: exchangeId }
  } else {
    medusa = { medusa_return_id: await startMedusaReturn(scope, order.id, items, id) }
  }

  const pickup = await bookPickup(order, request)
  const updated = await returns(scope).updateReturnRequests({
    id,
    status: "approved",
    ...medusa,
    pickup,
    pickup_awb: "awb" in pickup ? pickup.awb : null,
  })
  await notifyReturn(scope, id, "approved")
  return updated
}

export async function rejectRequest(scope: MedusaContainer, id: string, reason: string) {
  const request = await load(scope, id)
  requireStatus(request, ["requested"])
  const updated = await returns(scope).updateReturnRequests({
    id,
    status: "rejected",
    reject_reason: reason.trim().slice(0, 300),
    // Nothing will be refunded: do not keep the customer's account details
    refund_details: null,
  })
  await notifyReturn(scope, id, "rejected")
  return updated
}

/**
 * The items arrived at the warehouse and were checked: they go back into
 * stock; online payments are refunded through Razorpay, COD refunds wait for
 * staff to send the money; exchanges wait for the new size to be shipped.
 */
export async function receiveRequest(scope: MedusaContainer, id: string) {
  const request = await load(scope, id)
  requireStatus(request, ["approved", "picked_up"])
  await receiveMedusaReturn(
    scope,
    request.medusa_return_id,
    (request.items as RequestItem[]).map((i) => ({ id: i.line_item_id, quantity: i.quantity }))
  )

  let status = "received"
  if (request.type === "return") {
    if (request.refund_details) {
      status = "refund_due"
    } else {
      const order = await orderFor(scope, request.order_id)
      const payment = (order.payment_collections ?? [])
        .flatMap((c: any) => c.payments ?? [])
        .find((p: any) => p.provider_id === RAZORPAY_PROVIDER_ID && p.captured_at)
      if (!payment) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No online payment to refund")
      await refundPaymentWorkflow(scope).run({ input: { payment_id: payment.id, amount: Number(request.refund_amount) } })
      status = "refunded"
    }
  }
  const updated = await returns(scope).updateReturnRequests({ id, status })
  await notifyReturn(scope, id, "received")
  return updated
}

/** COD refunds: staff sent the money by UPI or bank transfer. The account details are then deleted. */
export async function markRefunded(scope: MedusaContainer, id: string, reference: string) {
  const request = await load(scope, id)
  requireStatus(request, ["refund_due"])
  await notifyReturn(scope, id, "refunded")
  return returns(scope).updateReturnRequests({
    id,
    status: "refunded",
    refund_reference: `${reference.trim().slice(0, 100)} (${maskRefundDetails(request.refund_details)})`,
    refund_details: null,
  })
}

/** Exchange: the new size has been shipped (called when its parcel ships). */
export async function completeExchangeFor(scope: MedusaContainer, requestId: string) {
  const request = await returns(scope).retrieveReturnRequest(requestId).catch(() => null)
  if (request?.type === "exchange" && request.status === "received") {
    await returns(scope).updateReturnRequests({ id: requestId, status: "completed" })
  }
}

