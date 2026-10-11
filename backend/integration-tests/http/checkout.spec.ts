import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createHmac } from "crypto"
import { writeFileSync } from "fs"
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { SHOP } from "../../src/config/shop"
import { shopHelpers, signUpCustomer } from "./helpers"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startFakeRazorpay, KEY_ID, KEY_SECRET } = require("../fake-razorpay")

jest.setTimeout(180 * 1000)

process.env.SMS_PROVIDER = "console"
process.env.OTP_TEST_CODE = "123456"
process.env.RAZORPAY_KEY_ID = KEY_ID
process.env.RAZORPAY_KEY_SECRET = KEY_SECRET
process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret"

// A fake Razorpay API on localhost (see ../fake-razorpay.js)
let fake: Awaited<ReturnType<typeof startFakeRazorpay>>
const rzp = {
  get orders() {
    return fake.state.orders as Map<string, any>
  },
  get payments() {
    return fake.state.payments as Map<string, { id: string; status: string; amount: number; order_id: string }>
  },
  pay: (orderId: string, amount?: number) => fake.state.pay(orderId, amount),
}
beforeAll(async () => {
  fake = await startFakeRazorpay()
  process.env.RAZORPAY_API_BASE = fake.url
})
afterAll(() => fake.close())

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    const shop = shopHelpers(api, getContainer)
    let store: Record<string, string>
    let regionId: string
    let cheap: { id: string; price: number }
    let expensive: { id: string; price: number }

    beforeEach(async () => {
      await shop.seed()
      ;({ store, regionId, cheap, expensive } = shop)
    })

    /** Makes the customer's SMS login look `minutes` old. */
    async function ageLogin(phone: string, minutes: number) {
      const auth = getContainer().resolve(Modules.AUTH)
      const [identity] = await auth.listProviderIdentities({ entity_id: `+91${phone}` })
      const old = Date.now() - minutes * 60 * 1000
      await auth.updateProviderIdentities([
        { id: identity.id, provider_metadata: { ...identity.provider_metadata, verified_at: old, last_sent_at: old, sends: [] } },
      ])
    }

    const paymentStatus = async (orderId: string, headers: Record<string, string>) => {
      const { data } = await api.get(`/store/orders/${orderId}?fields=payment_status`, { headers })
      return data.order.payment_status
    }

    /** A logged-in customer's cart with an address and delivery, ready to pay. */
    async function readyCart(variant: { id: string }, quantity = 1, loginMinutesAgo = 0) {
      const ready = await shop.readyCart(variant, quantity)
      if (loginMinutesAgo) await ageLogin(ready.phone, loginMinutesAgo)
      expect(ready.options).toHaveLength(1)
      return ready
    }

    const complete = shop.complete

    async function startRazorpay(cartId: string, headers: Record<string, string>) {
      const { data } = await api.post("/store/payment-collections", { cart_id: cartId }, { headers })
      const { data: withSession } = await api.post(
        `/store/payment-collections/${data.payment_collection.id}/payment-sessions`,
        { provider_id: "pp_razorpay_razorpay", data: { razorpay_order_id: "order_forged" } },
        { headers }
      )
      return withSession.payment_collection.payment_sessions[0]
    }

    describe("delivery charge", () => {
      it(`is ₹${SHOP.shippingFee} below ₹${SHOP.freeShippingFrom} and free from it`, async () => {
        const below = await readyCart(cheap)
        expect(below.cart.shipping_total).toBe(SHOP.shippingFee)
        const above = await readyCart(expensive)
        expect(above.cart.shipping_total).toBe(0)
      })

      it("only offers real payment methods", async () => {
        const { data } = await api.get(`/store/payment-providers?region_id=${regionId}`, { headers: store })
        expect(data.payment_providers.map((p: any) => p.id).sort()).toEqual(["pp_cod_cod", "pp_razorpay_razorpay"])
      })
    })

    describe("cash on delivery", () => {
      it("needs no second code right after an SMS login", async () => {
        const { cartId, customer } = await readyCart(cheap)
        const request = await api.post("/store/cod/request", { cart_id: cartId }, { headers: customer })
        expect(request.data).toMatchObject({ sent: false, verified: true })
        await api.post("/store/cod/confirm", { cart_id: cartId }, { headers: customer })
        const result = await complete(cartId, customer)
        expect(result.type).toBe("order")
        expect(await paymentStatus(result.order.id, customer)).toBe("authorized")
      })

      it("places the order after the SMS code when the login is older", async () => {
        const { cartId, customer } = await readyCart(cheap, 1, 30)
        const noCode = await api.post("/store/cod/confirm", { cart_id: cartId }, { headers: customer }).catch((e) => e.response)
        expect(noCode.status).toBe(401)

        const request = await api.post("/store/cod/request", { cart_id: cartId }, { headers: customer })
        expect(request.data).toMatchObject({ sent: true, phone: expect.stringContaining("•") })

        const wrong = await api
          .post("/store/cod/confirm", { cart_id: cartId, code: "000000" }, { headers: customer })
          .catch((e) => e.response)
        expect(wrong.status).toBe(401)

        await api.post("/store/cod/confirm", { cart_id: cartId, code: "123456" }, { headers: customer })
        const result = await complete(cartId, customer)
        expect(result.type).toBe("order")
        expect(await paymentStatus(result.order.id, customer)).toBe("authorized")
        expect(result.order.total).toBe(cheap.price + SHOP.shippingFee)

        // GST invoice: only for this customer
        const pdf = await api.get(`/store/orders/${result.order.id}/invoice`, { headers: customer, responseType: "arraybuffer" })
        expect(pdf.headers["content-type"]).toBe("application/pdf")
        const bytes = Buffer.from(pdf.data)
        expect(bytes.subarray(0, 5).toString()).toBe("%PDF-")
        if (process.env.INVOICE_SAMPLE) writeFileSync(process.env.INVOICE_SAMPLE, bytes)
        const other = await signUpCustomer(api, store, shop.nextPhone(), "Ravi")
        const refused = await api.get(`/store/orders/${result.order.id}/invoice`, { headers: other }).catch((e) => e.response)
        expect(refused.status).toBe(404)
        const anonymous = await api.get(`/store/orders/${result.order.id}/invoice`, { headers: store }).catch((e) => e.response)
        expect(anonymous.status).toBe(401)
      })

      it("refuses a cash-on-delivery session made without the code", async () => {
        const { cartId, customer } = await readyCart(cheap)
        const { data } = await api.post("/store/payment-collections", { cart_id: cartId }, { headers: customer })
        await api.post(
          `/store/payment-collections/${data.payment_collection.id}/payment-sessions`,
          { provider_id: "pp_cod_cod", data: { cod_token: "a".repeat(64), amount: 1 } },
          { headers: customer }
        )
        const result = await complete(cartId, customer).catch((e) => e.response.data)
        expect(result.type).not.toBe("order")
      })

      it("is not offered above the limit", async () => {
        const quantity = Math.ceil((SHOP.codMaxOrder + 1) / expensive.price)
        const { cartId, customer } = await readyCart(expensive, quantity)
        const res = await api.post("/store/cod/request", { cart_id: cartId }, { headers: customer }).catch((e) => e.response)
        expect(res.status).toBe(400)
        expect(res.data.type).toBe("cod_limit")
      })

      it("only works on the customer's own cart", async () => {
        const { cartId } = await readyCart(cheap)
        const other = await signUpCustomer(api, store, shop.nextPhone(), "Ravi")
        const res = await api.post("/store/cod/request", { cart_id: cartId }, { headers: other }).catch((e) => e.response)
        expect(res.status).toBe(404)
      })
    })

    describe("Razorpay", () => {
      it("creates a Razorpay order for the cart total, ignoring data from the browser", async () => {
        const { cartId, customer, cart } = await readyCart(expensive)
        const session = await startRazorpay(cartId, customer)
        expect(session.data).toMatchObject({ key_id: KEY_ID, amount: cart.total * 100, currency: "INR" })
        expect(session.data.razorpay_order_id).not.toBe("order_forged")
        const order = rzp.orders.get(session.data.razorpay_order_id)
        expect(order).toMatchObject({ amount: cart.total * 100, notes: { session_id: session.id }, payment: { capture: "manual" } })
      })

      it("places the order only once Razorpay has the payment, then captures it", async () => {
        const { cartId, customer } = await readyCart(expensive)
        const session = await startRazorpay(cartId, customer)

        const unpaid = await complete(cartId, customer).catch((e) => e.response.data)
        expect(unpaid.type).not.toBe("order")

        const payment = rzp.pay(session.data.razorpay_order_id)
        const paid = await complete(cartId, customer)
        expect(paid.type).toBe("order")
        expect(await paymentStatus(paid.order.id, customer)).toBe("captured")
        expect(rzp.payments.get(payment.id)!.status).toBe("captured")

        // A refund from the admin goes to Razorpay
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({
          entity: "order",
          fields: ["payment_collections.payments.id"],
          filters: { id: paid.order.id },
        })
        const paymentId = (data[0] as any).payment_collections[0].payments[0].id
        await refundPaymentWorkflow(getContainer()).run({ input: { payment_id: paymentId, amount: 500 } })
        expect(fake.state.refunds).toContainEqual({ payment_id: payment.id, amount: 50000 })
      })

      it("does not take the money when the item sold out before the order was placed", async () => {
        const { cartId, customer } = await readyCart(expensive)
        const session = await startRazorpay(cartId, customer)
        const payment = rzp.pay(session.data.razorpay_order_id)

        // Someone else bought the last pieces meanwhile
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({
          entity: "variant",
          fields: ["inventory_items.inventory.location_levels.*"],
          filters: { id: expensive.id },
        })
        const levels = (data[0] as any).inventory_items[0].inventory.location_levels
        const inventory = getContainer().resolve(Modules.INVENTORY)
        await inventory.updateInventoryLevels(
          levels.map((l: any) => ({ inventory_item_id: l.inventory_item_id, location_id: l.location_id, stocked_quantity: 0 }))
        )

        const result = await complete(cartId, customer).catch((e) => e.response.data)
        expect(result.type).not.toBe("order")
        expect(JSON.stringify(result)).toMatch(/not enough stock/i)
        // Left uncaptured: Razorpay refunds it automatically
        expect(rzp.payments.get(payment.id)!.status).toBe("authorized")
      })

      it("does not accept a payment for a different amount", async () => {
        const { cartId, customer } = await readyCart(expensive)
        const session = await startRazorpay(cartId, customer)
        rzp.pay(session.data.razorpay_order_id, 100)
        const result = await complete(cartId, customer).catch((e) => e.response.data)
        expect(result.type).not.toBe("order")
      })

      it("completes the order from the signed webhook when the shopper closed the page", async () => {
        const { cartId, customer } = await readyCart(expensive)
        const session = await startRazorpay(cartId, customer)
        const payment = rzp.pay(session.data.razorpay_order_id)

        const send = (secret: string) => {
          const body = JSON.stringify({ event: "payment.authorized", payload: { payment: { entity: payment } } })
          const signature = createHmac("sha256", secret).update(body).digest("hex")
          return api.post("/hooks/payment/razorpay_razorpay", body, {
            headers: { "content-type": "application/json", "x-razorpay-signature": signature },
          })
        }
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const orderFor = async () =>
          (await query.graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: cartId } })).data[0]
        const waitForOrder = async (ms: number) => {
          for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 500))) {
            if (await orderFor()) return true
          }
          return false
        }

        // A forged webhook does nothing
        await send("wrong-secret")
        expect(await waitForOrder(8000)).toBe(false)

        await send("webhook-secret")
        expect(await waitForOrder(20000)).toBe(true)
        expect(rzp.payments.get(payment.id)!.status).toBe("captured")
      })
    })
  },
})
