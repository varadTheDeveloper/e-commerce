"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { updateTag } from "next/cache"
import { getAuthHeaders, getCacheTag, getCartId, removeCartId } from "./cookies"
import { retrieveCart } from "./cart"
import { retrieveCustomer } from "./customer"
import { CHECKOUT_CART_FIELDS, RAZORPAY_PROVIDER_ID } from "@lib/util/checkout"

// Checkout: delivery address, then Razorpay or cash on delivery, then the order.
// Every action re-reads the cart on the server; errors come back as codes that
// the page shows in the visitor's language.

export type CheckoutError =
  | "out_of_stock"
  | "payment_not_received"
  | "not_ready"
  | "cod_limit"
  | "cod_unavailable"
  | "not_serviceable"
  | "payment_unavailable"
  | "wrong_code"
  | "locked"
  | "too_soon"
  | "too_many"
  | "sms_failed"
  | "generic"

type Fail = { ok: false; error: CheckoutError; items?: string[] }

export type ShopSettings = { free_shipping_from: number; shipping_fee: number; cod_max_order: number }

export async function getShopSettings(): Promise<ShopSettings> {
  return sdk.client.fetch<ShopSettings>("/store/shop-settings", { method: "GET", cache: "no-store" })
}

async function refreshCart() {
  updateTag(await getCacheTag("carts"))
}

function errorFrom(e: unknown): Fail {
  const err = e as { status?: number; message?: string }
  const msg = String(err?.message ?? "")
  if (/stock/i.test(msg)) return { ok: false, error: "out_of_stock" }
  if (/do not deliver to this pincode/i.test(msg)) return { ok: false, error: "not_serviceable" }
  if (/cash on delivery is not available for this pincode/i.test(msg)) return { ok: false, error: "cod_unavailable" }
  if (/cash on delivery is available up to/i.test(msg)) return { ok: false, error: "cod_limit" }
  if (/delivery address/i.test(msg)) return { ok: false, error: "not_ready" }
  if (/Too many wrong codes/i.test(msg)) return { ok: false, error: "locked" }
  if (err?.status === 401 || /code/i.test(msg)) return { ok: false, error: "wrong_code" }
  if (err?.status === 429) return { ok: false, error: /too many/i.test(msg) ? "too_many" : "too_soon" }
  if (/SMS/i.test(msg)) return { ok: false, error: "sms_failed" }
  if (/not set up|Online payment/i.test(msg)) return { ok: false, error: "payment_unavailable" }
  return { ok: false, error: "generic" }
}

/**
 * Uses one of the customer's saved addresses for delivery (the newest one when
 * no id is given, e.g. right after adding it) and sets the delivery method.
 */
export async function setDeliveryAddress(addressId?: string): Promise<{ ok: true } | Fail> {
  const [cartId, customer] = await Promise.all([getCartId(), retrieveCustomer()])
  const addresses = [...(customer?.addresses ?? [])]
  const address = addressId
    ? addresses.find((a) => a.id === addressId)
    : addresses.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
  if (!cartId || !customer || !address) return { ok: false, error: "not_ready" }
  const headers = await getAuthHeaders()
  const fields = {
    first_name: address.first_name ?? "",
    last_name: address.last_name ?? "",
    phone: address.phone ?? "",
    address_1: address.address_1 ?? "",
    address_2: address.address_2 ?? "",
    city: address.city ?? "",
    province: address.province ?? "",
    postal_code: address.postal_code ?? "",
    country_code: "in",
    metadata: address.metadata ?? undefined,
  }
  try {
    await sdk.store.cart.update(cartId, { shipping_address: fields, billing_address: fields }, {}, headers)
    const { shipping_options } = await sdk.store.fulfillment.listCartOptions({ cart_id: cartId }, headers)
    const option = shipping_options?.[0]
    if (!option) return { ok: false, error: "not_ready" }
    await sdk.store.cart.addShippingMethod(cartId, { option_id: option.id }, {}, headers)
    await refreshCart()
    return { ok: true }
  } catch (e) {
    return errorFrom(e)
  } finally {
    await refreshCart()
  }
}

/**
 * Items in the bag that are no longer in stock in the chosen quantity (their
 * titles). Placing the order checks stock again on the server; this check only
 * spares the customer a payment that would not go through.
 */
async function outOfStock(cart: HttpTypes.StoreCart): Promise<string[]> {
  const items = cart.items ?? []
  const ids = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[]
  if (!ids.length) return []
  const { products } = await sdk.store.product.list(
    {
      id: ids,
      region_id: cart.region_id,
      limit: ids.length,
      fields: "id,*variants,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder",
    },
    await getAuthHeaders()
  )
  const variants = new Map(products.flatMap((p) => p.variants ?? []).map((v) => [v.id, v]))
  return items
    .filter((i) => {
      const v = variants.get(i.variant_id ?? "") as (HttpTypes.StoreProductVariant & { allow_backorder?: boolean }) | undefined
      return !!v?.manage_inventory && !v.allow_backorder && typeof v.inventory_quantity === "number" && v.inventory_quantity < i.quantity
    })
    .map((i) => i.product_title ?? i.title ?? "")
}

async function readyCart(): Promise<{ ok: true; cart: HttpTypes.StoreCart } | Fail> {
  const cart = await retrieveCart(undefined, CHECKOUT_CART_FIELDS)
  if (!cart?.items?.length || !cart.shipping_address || !cart.shipping_methods?.length) {
    return { ok: false, error: "not_ready" }
  }
  const missing = await outOfStock(cart).catch(() => [])
  if (missing.length) return { ok: false, error: "out_of_stock", items: missing }
  return { ok: true, cart }
}

/**
 * Prepares an online payment: checks stock and creates the Razorpay order on
 * the server. Returns what Razorpay Checkout needs in the browser.
 */
export async function startOnlinePayment(): Promise<
  { ok: true; keyId: string; orderId: string; amount: number; phone?: string; name?: string; email?: string } | Fail
> {
  const ready = await readyCart()
  if (!ready.ok) return ready
  try {
    const res = await sdk.store.payment.initiatePaymentSession(ready.cart, { provider_id: RAZORPAY_PROVIDER_ID }, {}, await getAuthHeaders())
    await refreshCart()
    const session = res.payment_collection?.payment_sessions?.find((s) => s.provider_id === RAZORPAY_PROVIDER_ID)
    const data = (session?.data ?? {}) as { key_id?: string; razorpay_order_id?: string; amount?: number }
    if (!data.key_id || !data.razorpay_order_id || !data.amount) return { ok: false, error: "payment_unavailable" }
    const customer = await retrieveCustomer()
    return {
      ok: true,
      keyId: data.key_id,
      orderId: data.razorpay_order_id,
      amount: data.amount,
      phone: ready.cart.shipping_address?.phone ?? customer?.phone ?? undefined,
      name: ready.cart.shipping_address?.first_name ?? undefined,
      email: customer?.email ?? undefined,
    }
  } catch (e) {
    const failed = errorFrom(e)
    return failed.error === "generic" ? { ok: false, error: "payment_unavailable" } : failed
  }
}

/** Asks for the SMS code that confirms a cash-on-delivery order (or none, right after login). */
export async function requestCodCode(): Promise<{ ok: true; needsCode: boolean; phone: string; resendAfter: number } | Fail> {
  const ready = await readyCart()
  if (!ready.ok) return ready
  try {
    const res = await sdk.client.fetch<{ sent: boolean; verified?: boolean; phone: string; resend_after?: number }>("/store/cod/request", {
      method: "POST",
      body: { cart_id: ready.cart.id },
      headers: await getAuthHeaders(),
    })
    return { ok: true, needsCode: !res.verified, phone: res.phone, resendAfter: res.resend_after ?? 30 }
  } catch (e) {
    return errorFrom(e)
  }
}

/** Confirms cash on delivery (with the SMS code when one was sent) and places the order. */
export async function confirmCodAndPlaceOrder(code?: string): Promise<{ ok: true; orderId: string } | Fail> {
  const ready = await readyCart()
  if (!ready.ok) return ready
  try {
    await sdk.client.fetch("/store/cod/confirm", {
      method: "POST",
      body: code ? { cart_id: ready.cart.id, code } : { cart_id: ready.cart.id },
      headers: await getAuthHeaders(),
    })
  } catch (e) {
    return errorFrom(e)
  }
  return placeOrder("cod")
}

/** Completes the cart. For online payments the server checks with Razorpay first. */
export async function placeOrder(kind: "online" | "cod" = "online"): Promise<{ ok: true; orderId: string } | Fail> {
  const cartId = await getCartId()
  if (!cartId) return { ok: false, error: "not_ready" }
  try {
    const res = await sdk.store.cart.complete(cartId, {}, await getAuthHeaders())
    await refreshCart()
    if (res.type === "order") {
      updateTag(await getCacheTag("orders"))
      await removeCartId()
      return { ok: true, orderId: res.order.id }
    }
    const failed = errorFrom({ message: (res as { error?: { message?: string } }).error?.message })
    return failed.error === "generic" && kind === "online" ? { ok: false, error: "payment_not_received" } : failed
  } catch (e) {
    const failed = errorFrom(e)
    return failed.error === "generic" && kind === "online" ? { ok: false, error: "payment_not_received" } : failed
  }
}
