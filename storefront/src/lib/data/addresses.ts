"use server"

import { sdk } from "@lib/config"
import { INDIAN_STATES, localMobile, MOBILE, PINCODE } from "@lib/india"
import { updateTag } from "next/cache"
import { getAuthHeaders, getCacheTag } from "./cookies"

// Customer addresses in Indian format. Stored as Medusa addresses:
// first_name = full name, address_1 = flat/house/building, address_2 = area,
// province = state, metadata = { landmark, type: "home" | "work" }.

export type AddressInput = {
  fullName: string
  phone: string
  pincode: string
  house: string
  area: string
  landmark?: string
  city: string
  state: string
  type: "home" | "work"
  isDefault?: boolean
}

export type AddressError = { field: keyof AddressInput | "form"; code: "required" | "invalidPincode" | "invalidPhone" | "failed" }

function validate(a: AddressInput): AddressError | null {
  for (const field of ["fullName", "phone", "pincode", "house", "area", "city", "state"] as const) {
    if (!String(a[field] ?? "").trim()) return { field, code: "required" }
  }
  if (!MOBILE.test(localMobile(a.phone))) return { field: "phone", code: "invalidPhone" }
  if (!PINCODE.test(a.pincode.trim())) return { field: "pincode", code: "invalidPincode" }
  if (!(INDIAN_STATES as readonly string[]).includes(a.state)) return { field: "state", code: "required" }
  return null
}

function toMedusa(a: AddressInput) {
  const clip = (s: string | undefined, n: number) => (s ?? "").trim().slice(0, n)
  return {
    first_name: clip(a.fullName, 80),
    last_name: "",
    phone: `+91${localMobile(a.phone)}`,
    postal_code: a.pincode.trim(),
    address_1: clip(a.house, 120),
    address_2: clip(a.area, 120),
    city: clip(a.city, 60),
    province: a.state,
    country_code: "in",
    metadata: { landmark: clip(a.landmark, 80), type: a.type === "work" ? "work" : "home" },
    is_default_shipping: !!a.isDefault,
    is_default_billing: !!a.isDefault,
  }
}

async function done() {
  updateTag(await getCacheTag("customers"))
}

/** Creates (id null) or updates an address. */
export async function saveAddress(id: string | null, input: AddressInput): Promise<{ ok: true } | { ok: false; error: AddressError }> {
  const error = validate(input)
  if (error) return { ok: false, error }
  const headers = await getAuthHeaders()
  try {
    if (id) await sdk.store.customer.updateAddress(id, toMedusa(input), {}, headers)
    else await sdk.store.customer.createAddress(toMedusa(input), {}, headers)
    await done()
    return { ok: true }
  } catch {
    return { ok: false, error: { field: "form", code: "failed" } }
  }
}

export async function deleteAddress(id: string): Promise<void> {
  await sdk.store.customer.deleteAddress(id, await getAuthHeaders()).catch(() => {})
  await done()
}

export async function makeDefaultAddress(id: string): Promise<void> {
  await sdk.store.customer
    .updateAddress(id, { is_default_shipping: true, is_default_billing: true }, {}, await getAuthHeaders())
    .catch(() => {})
  await done()
}
