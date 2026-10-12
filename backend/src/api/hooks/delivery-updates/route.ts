import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  capturePaymentWorkflow,
  createOrderShipmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
} from "@medusajs/medusa/core-flows"
import { timingSafeEqual } from "crypto"
import { COD_PROVIDER_ID } from "../../../lib/payment-ids"
import { completeExchangeFor } from "../../../lib/return-actions"
import { RETURNS_MODULE } from "../../../modules/returns"
import { nextTracking, stageFor, Tracking } from "../../../lib/tracking"
import { trackingUrl } from "../../../modules/shiprocket/service"

// Shiprocket's tracking webhook (Settings → API → Webhooks in the Shiprocket
// panel). The address must not contain "shiprocket", hence this name. Shiprocket
// sends the token set there in the x-api-key header.

function tokenOk(header: unknown): boolean {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN
  if (!expected || typeof header !== "string") return false
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function orderIdForAwb(req: MedusaRequest, awb: string): Promise<string | null> {
  const fulfillments = await req.scope
    .resolve(Modules.FULFILLMENT)
    .listFulfillments({ labels: { tracking_number: awb } } as any, { select: ["id"] })
  if (!fulfillments.length) return null
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order_fulfillment",
    fields: ["order_id"],
    filters: { fulfillment_id: fulfillments.map((f) => f.id) },
  })
  return (data[0] as any)?.order_id ?? null
}

/** POST /hooks/delivery-updates — courier status updates for shipped orders. */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!tokenOk(req.headers["x-api-key"])) {
    return res.status(401).json({ message: "Unauthorized" })
  }
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const body = (req.body ?? {}) as Record<string, any>
  const awb = String(body.awb ?? body.awb_code ?? "").trim()
  const status = String(body.current_status ?? body.shipment_status ?? "").trim()
  const stage = stageFor(status)
  // Shiprocket expects 200 for everything it sends, even updates we do not use
  if (!awb || !stage) {
    if (awb) logger.info(`Delivery update ignored (status "${status.slice(0, 40)}")`)
    return res.sendStatus(200)
  }

  // A return pickup on its way back to the warehouse
  const returns = req.scope.resolve(RETURNS_MODULE) as any
  const [returnRequest] = await returns.listReturnRequests({ pickup_awb: awb }, { take: 1 })
  if (returnRequest) {
    if (["shipped", "out_for_delivery", "delivered"].includes(stage) && returnRequest.status === "approved") {
      await returns.updateReturnRequests({ id: returnRequest.id, status: "picked_up" })
    }
    return res.sendStatus(200)
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  // Our order id is the start of the id we gave Shiprocket; without it, find the parcel by its tracking number
  let orderId = String(body.order_id ?? body.channel_order_id ?? "").split("-")[0]
  if (!orderId.startsWith("order_")) {
    orderId = (await orderIdForAwb(req, awb)) ?? ""
  }
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "status",
      "metadata",
      "fulfillments.id",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
      "fulfillments.data",
      "fulfillments.items.line_item_id",
      "items.id",
      "items.metadata",
      "fulfillments.items.quantity",
      "fulfillments.labels.tracking_number",
      "payment_collections.payments.id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.amount",
      "payment_collections.payments.captured_at",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as any
  const fulfillment = (order?.fulfillments ?? []).find(
    (f: any) => !f.canceled_at && (f.data?.awb === awb || (f.labels ?? []).some((l: any) => l.tracking_number === awb))
  )
  if (!order || !fulfillment) {
    logger.warn(`Delivery update for an unknown parcel (order ${orderId.slice(0, 40) || "missing"})`)
    return res.sendStatus(200)
  }

  const at = new Date().toISOString()
  const tracking = nextTracking(order.metadata?.tracking as Tracking | undefined, {
    stage,
    status,
    awb,
    courier: fulfillment.data?.courier ?? (typeof body.courier_name === "string" ? body.courier_name : undefined),
    url: trackingUrl(awb),
    at,
  })
  await req.scope.resolve(Modules.ORDER).updateOrders([{ id: order.id, metadata: { ...(order.metadata ?? {}), tracking } }])

  const reached = (s: string) => ["shipped", "out_for_delivery", "delivery_failed", "delivered"].includes(s)
  if (reached(stage) && !fulfillment.shipped_at) {
    // A new size sent for an exchange: that request is now complete
    for (const fi of fulfillment.items ?? []) {
      const requestId = (order.items ?? []).find((i: any) => i.id === fi.line_item_id)?.metadata?.return_request_id
      if (requestId) await completeExchangeFor(req.scope, requestId)
    }
    await createOrderShipmentWorkflow(req.scope).run({
      input: {
        order_id: order.id,
        fulfillment_id: fulfillment.id,
        items: (fulfillment.items ?? []).map((i: any) => ({ id: i.line_item_id, quantity: i.quantity })),
        labels: [{ tracking_number: awb, tracking_url: trackingUrl(awb), label_url: fulfillment.data?.label_url ?? "" }],
      },
    })
  }
  if (stage === "delivered" && !fulfillment.delivered_at) {
    await markOrderFulfillmentAsDeliveredWorkflow(req.scope).run({ input: { orderId: order.id, fulfillmentId: fulfillment.id } })
    // Cash on delivery: the courier has collected the money
    const cod = (order.payment_collections ?? [])
      .flatMap((c: any) => c.payments ?? [])
      .find((p: any) => p.provider_id === COD_PROVIDER_ID && !p.captured_at)
    if (cod) {
      await capturePaymentWorkflow(req.scope).run({ input: { payment_id: cod.id } })
      // Later parcels for this order (exchanges) must not collect cash again
      await req.scope.resolve(Modules.ORDER).updateOrders([{ id: order.id, metadata: { cod_collected: true } }])
    }
  }
  res.sendStatus(200)
}
