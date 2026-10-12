import { SELLER } from "../config/seller"
import { SHOP } from "../config/shop"
import { ShiprocketClient } from "../modules/shiprocket/client"

// One Shiprocket client per process (it keeps the login token), from the environment:
// SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD (an API user), SHIPROCKET_API_BASE (tests only).

let client: { key: string; value: ShiprocketClient } | null = null

export function shiprocketFromEnv(env = process.env): ShiprocketClient | null {
  const { SHIPROCKET_EMAIL: email, SHIPROCKET_PASSWORD: password, SHIPROCKET_API_BASE: base } = env
  if (!email || !password) return null
  const key = `${email}|${base ?? ""}`
  if (client?.key !== key) {
    client = { key, value: new ShiprocketClient(email, password, base || undefined) }
  }
  return client.value
}

export type DeliveryEstimate = {
  /** False when no courier delivers to this pincode */
  serviceable: boolean
  cod: boolean
  /** Expected delivery date (YYYY-MM-DD), when known */
  date: string | null
  /** False when Shiprocket is not set up: the shop then accepts any valid pincode */
  checked: boolean
}

const cache = new Map<string, { at: number; value: DeliveryEstimate }>()
const CACHE_MS = 6 * 60 * 60 * 1000

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** Delivery date from a courier's answer: its date if given, else today + days. */
export function courierDate(courier: { etd?: string; estimated_delivery_days?: string | number }, today = new Date()): string | null {
  if (courier.etd) {
    const parsed = new Date(`${courier.etd} 12:00:00 UTC`)
    if (!Number.isNaN(parsed.getTime())) return isoDate(parsed)
  }
  const days = Number(courier.estimated_delivery_days)
  if (Number.isFinite(days) && days > 0) {
    return isoDate(new Date(today.getTime() + days * 24 * 60 * 60 * 1000))
  }
  return null
}

/** Can the shop deliver to this pincode, with cash on delivery, and by when? Cached for 6 hours. */
export async function deliveryEstimate(pincode: string): Promise<DeliveryEstimate> {
  const sr = shiprocketFromEnv()
  if (!sr) return { serviceable: true, cod: true, date: null, checked: false }
  const hit = cache.get(pincode)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value

  const weightKg = SHOP.defaultPackage.weightGrams / 1000
  const base = { pickupPincode: SELLER.pickupPincode, pincode, weightKg }
  const withCod = await sr.serviceability({ ...base, cod: true })
  const couriers = withCod.couriers.length ? withCod : await sr.serviceability({ ...base, cod: false })
  const pick = couriers.couriers.find((c) => c.courier_company_id === couriers.recommended) ?? couriers.couriers[0]
  const value: DeliveryEstimate = {
    serviceable: couriers.couriers.length > 0,
    cod: withCod.couriers.length > 0,
    date: pick ? courierDate(pick) : null,
    checked: true,
  }
  cache.set(pincode, { at: Date.now(), value })
  return value
}

/** Tests only. */
export function clearDeliveryCache() {
  cache.clear()
}
