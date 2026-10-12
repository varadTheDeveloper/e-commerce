import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { notifyOrder } from "../notifications/send"
import { UpdateKind } from "../notifications/messages"

// Sends customers an email/SMS when their order is placed, shipped, delivered or cancelled.

type EventData = { id: string; no_notification?: boolean }

const KINDS: Record<string, UpdateKind> = {
  "order.placed": "placed",
  "shipment.created": "shipped",
  "delivery.created": "delivered",
  "order.canceled": "canceled",
}

export default async function orderUpdates({ event, container }: SubscriberArgs<EventData>) {
  const kind = KINDS[event.name]
  if (!kind || event.data.no_notification) return
  let orderId = event.data.id
  if (kind === "shipped" || kind === "delivered") {
    // These events carry the fulfillment id
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order_fulfillment",
      fields: ["order_id"],
      filters: { fulfillment_id: event.data.id },
    })
    orderId = (data[0] as any)?.order_id
    if (!orderId) return
  }
  await notifyOrder(container, orderId, kind)
}

export const config: SubscriberConfig = { event: Object.keys(KINDS) }
