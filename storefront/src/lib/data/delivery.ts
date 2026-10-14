"use server"

import { sdk } from "@lib/config"
import { forwardedFor } from "@lib/util/client-ip"

export type DeliveryEstimate = {
  serviceable: boolean
  cod: boolean
  /** YYYY-MM-DD, when known */
  date: string | null
  /** False when the shop could not check with the courier (then any valid pincode is accepted) */
  checked: boolean
}

/** Can the shop deliver to this pincode, with cash on delivery, and by when? */
export async function getDeliveryEstimate(pincode: string): Promise<DeliveryEstimate | null> {
  if (!/^[1-9]\d{5}$/.test(pincode)) return null
  return sdk.client
    .fetch<DeliveryEstimate>("/store/delivery-estimate", { method: "GET", query: { pincode }, headers: await forwardedFor(), cache: "no-store" })
    .catch(() => null)
}
