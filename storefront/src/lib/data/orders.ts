"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { updateTag } from "next/cache"
import { getAuthHeaders, getCacheTag } from "./cookies"
import { HttpTypes } from "@medusajs/types"

export const retrieveOrder = async (id: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
      method: "GET",
      query: {
        fields:
          "*payment_collections.payments,*items,*items.metadata,*items.variant,*items.product,+items.total,*shipping_address,+status,+total,+shipping_total,+customer_id,*fulfillments",
      },
      headers,
      // Delivery progress changes outside the shop (courier updates): always read fresh
      cache: "no-store",
    })
    .then(({ order }) => order)
    .catch((err) => medusaError(err))
}

export const listOrders = async (
  limit: number = 10,
  offset: number = 0,
  filters?: Record<string, any>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      method: "GET",
      query: {
        limit,
        offset,
        order: "-created_at",
        fields: "*items,+items.metadata,*items.variant,*items.product",
        ...filters,
      },
      headers,
      cache: "no-store",
    })
    .then(({ orders }) => orders)
    .catch((err) => medusaError(err))
}

export const createTransferRequest = async (
  state: {
    success: boolean
    error: string | null
    order: HttpTypes.StoreOrder | null
  },
  formData: FormData
): Promise<{
  success: boolean
  error: string | null
  order: HttpTypes.StoreOrder | null
}> => {
  const id = formData.get("order_id") as string

  if (!id) {
    return { success: false, error: "Order ID is required", order: null }
  }

  const headers = await getAuthHeaders()

  return await sdk.store.order
    .requestTransfer(
      id,
      {},
      {
        fields: "id, email",
      },
      headers
    )
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export const acceptTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .acceptTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export const declineTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .declineTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export type CancelReason = "changed_mind" | "ordered_by_mistake" | "found_cheaper" | "delivery_too_late" | "other"

/** The customer cancels their own order (allowed until it is shipped). */
export async function cancelOrder(orderId: string, reason: CancelReason): Promise<{ ok: boolean }> {
  try {
    await sdk.client.fetch(`/store/orders/${orderId}/cancel`, {
      method: "POST",
      body: { reason },
      headers: await getAuthHeaders(),
    })
    updateTag(await getCacheTag("orders"))
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export type OrderTracking = {
  tracking: { stage: string; awb?: string; courier?: string; url?: string; history?: { stage: string; at: string }[] } | null
  canceled_at: string | null
}

/** Delivery progress of the customer's order (always fresh: it changes with courier updates). */
export async function retrieveOrderTracking(id: string): Promise<OrderTracking> {
  return sdk.client
    .fetch<OrderTracking>(`/store/orders/${id}/tracking`, { method: "GET", headers: await getAuthHeaders(), cache: "no-store" })
    .catch(() => ({ tracking: null, canceled_at: null }))
}
