import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { COD_PROVIDER_ID } from "../lib/payment-ids"

/**
 * Records how an order was paid ("cod" or "online") in its metadata, from the
 * order's payment (never from anything the shopper sent). The courier booking
 * needs it: a COD parcel booked as prepaid would not be collected, so the
 * booking refuses orders without it.
 */
export default async function recordPaymentMethod({ event, container }: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "metadata", "payment_collections.payments.provider_id"],
    filters: { id: event.data.id },
  })
  const order = data[0] as any
  if (!order) return
  const providers: string[] = (order.payment_collections ?? []).flatMap((c: any) => (c.payments ?? []).map((p: any) => p.provider_id))
  const method = providers.includes(COD_PROVIDER_ID) ? "cod" : "online"
  if (order.metadata?.payment_method === method) return
  await container.resolve(Modules.ORDER).updateOrders([{ id: order.id, metadata: { ...(order.metadata ?? {}), payment_method: method } }])
}

export const config: SubscriberConfig = { event: "order.placed" }
