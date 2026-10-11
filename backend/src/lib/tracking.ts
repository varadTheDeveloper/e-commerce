// Delivery progress of an order, as customers see it. Kept in the order's
// metadata (`tracking`) and updated from the courier's status updates.

export type TrackingStage =
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivery_failed"
  | "delivered"
  | "returning"
  | "returned"
  | "cancelled"

export type Tracking = {
  stage: TrackingStage
  /** The courier's own status text, e.g. "IN TRANSIT" */
  status: string
  awb: string
  courier?: string
  /** Public tracking page for the parcel */
  url?: string
  updated_at: string
  /** When each stage was first reached */
  history: { stage: TrackingStage; at: string }[]
}

/** Maps Shiprocket status texts to stages. Unknown texts return null (logged, ignored). */
export function stageFor(status: string): TrackingStage | null {
  const s = status.trim().toUpperCase()
  if (!s) return null
  if (s === "DELIVERED") return "delivered"
  if (s === "OUT FOR DELIVERY") return "out_for_delivery"
  if (s === "UNDELIVERED" || s.startsWith("UNDELIVERED")) return "delivery_failed"
  if (s === "RTO DELIVERED") return "returned"
  if (s.startsWith("RTO")) return "returning"
  if (s === "CANCELED" || s === "CANCELLED") return "cancelled"
  if (
    ["PICKED UP", "SHIPPED", "IN TRANSIT", "REACHED AT DESTINATION HUB", "MISROUTED", "DELAYED", "REACHED BACK AT SELLER CITY"].includes(s) ||
    s.startsWith("IN TRANSIT")
  ) {
    return "shipped"
  }
  if (["PICKUP SCHEDULED", "PICKUP GENERATED", "OUT FOR PICKUP", "PICKUP EXCEPTION", "AWB ASSIGNED", "LABEL GENERATED", "MANIFEST GENERATED", "NEW"].includes(s)) {
    return "packed"
  }
  return null
}

/** New tracking state after an update; history keeps the first time each stage was reached. */
export function nextTracking(
  current: Tracking | undefined,
  update: { stage: TrackingStage; status: string; awb: string; courier?: string; url?: string; at: string }
): Tracking {
  const history = [...(current?.awb === update.awb ? current.history : [])]
  if (!history.some((h) => h.stage === update.stage)) history.push({ stage: update.stage, at: update.at })
  return {
    stage: update.stage,
    status: update.status,
    awb: update.awb,
    courier: update.courier ?? current?.courier,
    url: update.url ?? current?.url,
    updated_at: update.at,
    history: history.slice(-20),
  }
}
