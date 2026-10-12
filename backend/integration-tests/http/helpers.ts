import { Modules } from "@medusajs/framework/utils"

// Shared helpers for the HTTP integration tests. Needs SMS_PROVIDER=console
// and OTP_TEST_CODE=123456 in the environment (set by each spec).

export async function publishableHeaders(getContainer: () => any) {
  const apiKeys = getContainer().resolve(Modules.API_KEY)
  const [key] = await apiKeys.createApiKeys([{ title: "test", type: "publishable", created_by: "test" }])
  return { "x-publishable-api-key": key.token }
}

/** Signs up a customer with a phone code and returns headers for their requests. */
export async function signUpCustomer(api: any, headers: Record<string, string>, phone: string, firstName = "Test") {
  await api.post("/store/otp/request", { phone }, { headers })
  const { data } = await api.post("/auth/customer/phone-otp", { phone, code: "123456" })
  await api.post("/store/otp/account", { first_name: firstName, privacy_consent: true }, { headers: { ...headers, authorization: `Bearer ${data.token}` } })
  const refreshed = await api.post("/auth/token/refresh", {}, { headers: { authorization: `Bearer ${data.token}` } })
  return { ...headers, authorization: `Bearer ${refreshed.data.token}` }
}

export const ADDRESS = {
  first_name: "आशा",
  last_name: "पाटील",
  address_1: "12, Shivaji Nagar",
  address_2: "Near bus stand",
  city: "Jalna",
  province: "Maharashtra",
  postal_code: "431203",
  country_code: "in",
  phone: "9876543210",
}

type Variant = { id: string; price: number }

/**
 * A seeded shop and helpers to build carts for it. Call `seed()` in beforeEach
 * (the test runner empties the database between tests).
 */
export function shopHelpers(api: any, getContainer: () => any) {
  const { ContainerRegistrationKeys } = require("@medusajs/framework/utils")
  const seedDemoData = require("../../src/scripts/seed").default
  const { SHOP } = require("../../src/config/shop")
  let phoneNo = 9100000000 + Math.floor(Math.random() * 1000) * 1000

  const shop = {
    store: {} as Record<string, string>,
    regionId: "",
    cheap: undefined as unknown as Variant,
    expensive: undefined as unknown as Variant,

    async seed() {
      const container = getContainer()
      await seedDemoData({ container, args: [] })
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: keys } = await query.graph({ entity: "api_key", fields: ["token"], filters: { type: "publishable" } })
      shop.store = { "x-publishable-api-key": keys[0].token }
      const { data: regions } = await api.get("/store/regions", { headers: shop.store })
      shop.regionId = regions.regions[0].id
      const { data } = await api.get(
        `/store/products?region_id=${shop.regionId}&fields=*variants.calculated_price,%2Bvariants.inventory_quantity&limit=100`,
        { headers: shop.store }
      )
      const variants: Variant[] = data.products
        .flatMap((p: any) => p.variants)
        .filter((v: any) => v.inventory_quantity > 5)
        .map((v: any) => ({ id: v.id, price: v.calculated_price.calculated_amount }))
      shop.cheap = variants.find((v) => v.price < SHOP.freeShippingFrom)!
      shop.expensive = variants.find((v) => v.price >= SHOP.freeShippingFrom)!
      if (!shop.cheap || !shop.expensive) throw new Error("Seed has no suitable products")
    },

    nextPhone: () => String(++phoneNo),

    /** A logged-in customer's cart with an address and delivery, ready to pay. */
    async readyCart(variant: { id: string }, quantity = 1, phone = shop.nextPhone(), cartExtras: Record<string, unknown> = {}) {
      const customer = await signUpCustomer(api, shop.store, phone, "Asha")
      const { data } = await api.post("/store/carts", { region_id: shop.regionId, ...cartExtras }, { headers: customer })
      const cartId = data.cart.id
      await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variant.id, quantity }, { headers: customer })
      await api.post(`/store/carts/${cartId}`, { shipping_address: ADDRESS, billing_address: ADDRESS }, { headers: customer })
      const { data: options } = await api.get(`/store/shipping-options?cart_id=${cartId}`, { headers: customer })
      const { data: withShipping } = await api.post(
        `/store/carts/${cartId}/shipping-methods`,
        { option_id: options.shipping_options[0].id },
        { headers: customer }
      )
      return { cartId, customer, phone, cart: withShipping.cart, options: options.shipping_options }
    },

    complete: (cartId: string, headers: Record<string, string>) =>
      api.post(`/store/carts/${cartId}/complete`, {}, { headers }).then((r: any) => r.data),

    /** Places a cash-on-delivery order (the customer has just logged in, so no extra code). */
    async placeCodOrder(variant: { id: string } = shop.cheap, quantity = 1, cartExtras: Record<string, unknown> = {}) {
      const ready = await shop.readyCart(variant, quantity, shop.nextPhone(), cartExtras)
      await api.post("/store/cod/request", { cart_id: ready.cartId }, { headers: ready.customer })
      await api.post("/store/cod/confirm", { cart_id: ready.cartId }, { headers: ready.customer })
      const result = await shop.complete(ready.cartId, ready.customer)
      if (result.type !== "order") throw new Error("COD order was not placed")
      return { ...ready, order: result.order }
    },
  }
  return shop
}

/** Waits until `check` returns a truthy value (or fails after `ms`). */
export async function waitFor<T>(check: () => Promise<T>, ms = 15000): Promise<T> {
  const end = Date.now() + ms
  for (;;) {
    const value = await check()
    if (value) return value
    if (Date.now() > end) throw new Error("Timed out waiting")
    await new Promise((r) => setTimeout(r, 300))
  }
}

/**
 * Ships an order the way staff do ("Create fulfillment" for all items) and,
 * with `deliver`, sends the courier's DELIVERED update. Needs the fake
 * Shiprocket and SHIPROCKET_WEBHOOK_TOKEN set by the spec.
 */
export async function shipOrder(api: any, getContainer: () => any, orderId: string, deliver = false) {
  const { ContainerRegistrationKeys } = require("@medusajs/framework/utils")
  const { createOrderFulfillmentWorkflow } = require("@medusajs/medusa/core-flows")
  const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
  const read = async () =>
    (await query.graph({ entity: "order", fields: ["items.*", "metadata", "fulfillments.data", "fulfillments.canceled_at"], filters: { id: orderId } }))
      .data[0] as any
  const order = await waitFor(async () => {
    const o = await read()
    return o.metadata?.payment_method ? o : null
  })
  await createOrderFulfillmentWorkflow(getContainer()).run({
    input: { order_id: orderId, items: order.items.map((i: any) => ({ id: i.id, quantity: i.quantity })) },
  })
  const fulfillment = (await read()).fulfillments.filter((f: any) => !f.canceled_at).pop()
  if (deliver) {
    await api.post(
      "/hooks/delivery-updates",
      { awb: fulfillment.data.awb, current_status: "DELIVERED" },
      { headers: { "x-api-key": process.env.SHIPROCKET_WEBHOOK_TOKEN } }
    )
  }
  return fulfillment
}
