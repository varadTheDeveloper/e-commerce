"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

// Return and size-exchange requests for the customer's own orders.

export type ReturnReason = "too_small" | "too_large" | "damaged" | "wrong_item" | "not_as_shown" | "changed_mind" | "other"

export type ReturnInfo = {
  open: boolean
  window_ends_at: string | null
  cod: boolean
  items: {
    line_item_id: string
    title: string
    variant_title: string | null
    thumbnail: string | null
    quantity: number
    unit_paid: number
    returnable: boolean
    reason?: "not_returnable" | "already_requested" | "exchange_item"
    exchange_options: { variant_id: string; size: string; in_stock: boolean }[]
  }[]
  requests: {
    id: string
    type: "return" | "exchange"
    status: string
    items: { line_item_id: string; quantity: number; reason: ReturnReason; exchange_variant_id?: string }[]
    refund_amount: number | null
    reject_reason: string | null
    pickup: { awb?: string; courier?: string; tracking_url?: string } | null
    created_at: string
  }[]
}

export type ReturnError =
  | "photo_required"
  | "refund_details"
  | "window_closed"
  | "not_returnable"
  | "size_unavailable"
  | "invalid_photo"
  | "generic"

export async function getReturnInfo(orderId: string): Promise<ReturnInfo | null> {
  return sdk.client
    .fetch<ReturnInfo>(`/store/orders/${orderId}/returns`, { method: "GET", headers: await getAuthHeaders(), cache: "no-store" })
    .catch(() => null)
}

export type CreateReturnInput = {
  type: "return" | "exchange"
  items: { line_item_id: string; quantity: number; reason: ReturnReason; note?: string; exchange_variant_id?: string }[]
  photos?: string[]
  refund?: { method: "upi"; upi_id: string } | { method: "bank"; account_name: string; account_number: string; ifsc: string }
}

const KNOWN: ReturnError[] = ["photo_required", "refund_details", "window_closed", "not_returnable", "size_unavailable", "invalid_photo"]

export async function createReturn(orderId: string, input: CreateReturnInput): Promise<{ ok: true } | { ok: false; error: ReturnError }> {
  try {
    const res = await fetch(`${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/store/orders/${orderId}/returns`, {
      method: "POST",
      headers: {
        ...((await getAuthHeaders()) as Record<string, string>),
        "content-type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    })
    if (res.ok) return { ok: true }
    const body = (await res.json().catch(() => ({}))) as { type?: string }
    const code = KNOWN.find((k) => k === body.type) ?? (body.type === "too_many" ? "not_returnable" : "generic")
    return { ok: false, error: code }
  } catch {
    return { ok: false, error: "generic" }
  }
}
