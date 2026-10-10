"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"
import { listProductsFor } from "./catalog"

// Wishlist in the customer account. Returns product handles, like the
// browser wishlist, so both can be shown the same way.

type Items = { items: { product_id: string; handle: string }[] }

async function authHeaders() {
  const headers = await getAuthHeaders()
  return "authorization" in headers ? headers : null
}

/** The account wishlist, or null when nobody is logged in. */
export async function getAccountWishlist(): Promise<string[] | null> {
  const headers = await authHeaders()
  if (!headers) return null
  try {
    const res = await sdk.client.fetch<Items>("/store/customers/me/wishlist", { headers, cache: "no-store" })
    return res.items.map((i) => i.handle)
  } catch {
    return null
  }
}

async function idsFor(handles: string[]): Promise<string[]> {
  const products = await listProductsFor("en")
  return products.filter((p) => p.handle && handles.includes(p.handle)).map((p) => p.id)
}

/** Saves products (by handle); used for one heart tap and for merging the browser wishlist after login. */
export async function addToAccountWishlist(handles: string[]): Promise<string[] | null> {
  const headers = await authHeaders()
  if (!headers || !handles.length) return getAccountWishlist()
  const product_ids = await idsFor(handles.slice(0, 200))
  if (!product_ids.length) return getAccountWishlist()
  const res = await sdk.client.fetch<Items>("/store/customers/me/wishlist", { method: "POST", headers, body: { product_ids } })
  return res.items.map((i) => i.handle)
}

export async function removeFromAccountWishlist(handle: string): Promise<string[] | null> {
  const headers = await authHeaders()
  if (!headers) return null
  const [id] = await idsFor([handle])
  if (!id) return getAccountWishlist()
  const res = await sdk.client.fetch<Items>(`/store/customers/me/wishlist/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  })
  return res.items.map((i) => i.handle)
}
