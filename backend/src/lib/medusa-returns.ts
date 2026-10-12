import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  beginExchangeOrderWorkflow,
  beginReturnOrderWorkflow,
  confirmExchangeRequestWorkflow,
  confirmReturnRequestWorkflow,
  createExchangeShippingMethodWorkflow,
  orderExchangeAddNewItemWorkflow,
  orderExchangeRequestItemReturnWorkflow,
  beginReceiveReturnWorkflow,
  confirmReturnReceiveWorkflow,
  receiveItemReturnRequestWorkflow,
  requestItemReturnWorkflow,
} from "@medusajs/medusa/core-flows"

// Medusa's own return and exchange records for an approved request, so stock,
// order totals and the admin's order history stay right.

type Item = { id: string; quantity: number }

/** Returns go back to the shop's (single) stock location, so the items are restocked there. */
async function returnLocation(scope: MedusaContainer): Promise<string | undefined> {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: "stock_location", fields: ["id"] })
  return (data[0] as any)?.id
}

/** Records a return of `items` (order line item ids) on the order. Returns the Medusa return id. */
export async function startMedusaReturn(scope: MedusaContainer, orderId: string, items: Item[], requestId: string): Promise<string> {
  const { result: change } = await beginReturnOrderWorkflow(scope).run({
    input: { order_id: orderId, location_id: await returnLocation(scope), metadata: { return_request_id: requestId } },
  })
  const returnId = (change as any).return_id as string
  await requestItemReturnWorkflow(scope).run({ input: { return_id: returnId, items } })
  await confirmReturnRequestWorkflow(scope).run({ input: { return_id: returnId } })
  return returnId
}

/**
 * Records an exchange: `items` come back and each is replaced by another
 * variant at the price the customer paid (no money changes hands). The new
 * items are then shipped like any order item.
 */
export async function startMedusaExchange(
  scope: MedusaContainer,
  orderId: string,
  items: (Item & { variant_id: string; unit_price: number })[],
  outboundShippingOptionId: string,
  requestId: string
): Promise<{ exchangeId: string; returnId: string }> {
  const { result: change } = await beginExchangeOrderWorkflow(scope).run({
    input: { order_id: orderId, metadata: { return_request_id: requestId } },
  })
  const exchangeId = (change as any).exchange_id as string
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order_exchange", fields: ["id", "return_id"], filters: { id: exchangeId } })
  let returnId = (data[0] as any)?.return_id as string | undefined

  const requested = await orderExchangeRequestItemReturnWorkflow(scope).run({
    input: {
      exchange_id: exchangeId,
      return_id: returnId as string,
      location_id: await returnLocation(scope),
      items: items.map(({ id, quantity }) => ({ id, quantity })),
    },
  })
  returnId = returnId ?? ((requested.result as any)?.return_id as string)
  await orderExchangeAddNewItemWorkflow(scope).run({
    input: {
      exchange_id: exchangeId,
      items: items.map((i) => ({
        variant_id: i.variant_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        // Marks items that came through an exchange (they cannot be exchanged again)
        metadata: { from_exchange: true, return_request_id: requestId },
      })),
    },
  })
  await createExchangeShippingMethodWorkflow(scope).run({
    input: { exchange_id: exchangeId, shipping_option_id: outboundShippingOptionId, custom_amount: 0 },
  })
  await confirmExchangeRequestWorkflow(scope).run({ input: { exchange_id: exchangeId } })
  if (!returnId) {
    const again = await query.graph({ entity: "order_exchange", fields: ["return_id"], filters: { id: exchangeId } })
    returnId = (again.data[0] as any)?.return_id
  }
  return { exchangeId, returnId: returnId as string }
}

/**
 * Marks the returned items as received: they go back into stock. (Medusa
 * restocks only in this begin → receive → confirm flow.)
 */
export async function receiveMedusaReturn(scope: MedusaContainer, returnId: string, items: Item[]): Promise<void> {
  await beginReceiveReturnWorkflow(scope).run({ input: { return_id: returnId } })
  await receiveItemReturnRequestWorkflow(scope).run({ input: { return_id: returnId, items } })
  await confirmReturnReceiveWorkflow(scope).run({ input: { return_id: returnId } })
}
