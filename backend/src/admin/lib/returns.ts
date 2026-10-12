// Shared bits for the return request pages in the admin.

export type RequestRow = {
  id: string
  type: "return" | "exchange"
  status: string
  order_id: string
  order_number: number
  customer: string
  pieces: number
  refund_amount: number | null
  refund_to: string | null
  created_at: string
}

export const STATUS_LABEL: Record<string, string> = {
  requested: "Needs decision",
  approved: "Waiting for pickup",
  picked_up: "On its way back",
  received: "Received – ship new size",
  refund_due: "Send refund",
  refunded: "Refunded",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
}

export const STATUS_COLOR: Record<string, "red" | "orange" | "blue" | "green" | "grey"> = {
  requested: "orange",
  approved: "blue",
  picked_up: "blue",
  received: "orange",
  refund_due: "red",
  refunded: "green",
  completed: "green",
  rejected: "grey",
  cancelled: "grey",
}

export const REASON_LABEL: Record<string, string> = {
  too_small: "Too small",
  too_large: "Too large",
  damaged: "Damaged",
  wrong_item: "Wrong item",
  not_as_shown: "Not as shown",
  changed_mind: "Changed mind",
  other: "Other",
}

export const rupees = (n: number | null | undefined) => (n == null ? "–" : `₹${Number(n).toLocaleString("en-IN")}`)

/** Calls the shop's admin API with the staff member's login session. */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.message ?? `Request failed (${res.status})`)
  return body as T
}
