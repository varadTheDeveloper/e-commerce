import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import { clearDeliveryCache } from "../../src/lib/shiprocket"
import { ADDRESS, shopHelpers, waitFor } from "./helpers"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startFakeShiprocket, EMAIL, PASSWORD } = require("../fake-shiprocket")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startFakeRazorpay, KEY_ID, KEY_SECRET } = require("../fake-razorpay")

jest.setTimeout(180 * 1000)

process.env.SMS_PROVIDER = "console"
process.env.OTP_TEST_CODE = "123456"
process.env.SHIPROCKET_EMAIL = EMAIL
process.env.SHIPROCKET_PASSWORD = PASSWORD
process.env.SHIPROCKET_WEBHOOK_TOKEN = "hook-token"
process.env.RAZORPAY_KEY_ID = KEY_ID
process.env.RAZORPAY_KEY_SECRET = KEY_SECRET
process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret"

let shiprocket: any
let razorpay: any
beforeAll(async () => {
  shiprocket = await startFakeShiprocket()
  razorpay = await startFakeRazorpay()
  process.env.SHIPROCKET_API_BASE = shiprocket.url
  process.env.RAZORPAY_API_BASE = razorpay.url
})
afterAll(async () => {
  await shiprocket.close()
  await razorpay.close()
})

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    const shop = shopHelpers(api, getContainer)

    beforeEach(async () => {
      clearDeliveryCache()
      await shop.seed()
    })

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    async function orderWithFulfillments(orderId: string) {
      const { data } = await query().graph({
        entity: "order",
        fields: [
          "id",
          "metadata",
          "items.*",
          "fulfillments.id",
          "fulfillments.shipped_at",
          "fulfillments.delivered_at",
          "fulfillments.data",
          "fulfillments.labels.*",
          "payment_collections.payments.captured_at",
        ],
        filters: { id: orderId },
      })
      return data[0] as any
    }

    /** What staff do in the admin: "Create fulfillment" for all items. */
    async function ship(orderId: string) {
      // The payment method is recorded just after the order is placed
      const order = await waitFor(async () => {
        const o = await orderWithFulfillments(orderId)
        return o.metadata?.payment_method ? o : null
      })
      await createOrderFulfillmentWorkflow(getContainer()).run({
        input: { order_id: orderId, items: order.items.map((i: any) => ({ id: i.id, quantity: i.quantity })) },
      })
      return (await orderWithFulfillments(orderId)).fulfillments[0]
    }

    const hook = (body: Record<string, unknown>, token = "hook-token") =>
      api.post("/hooks/delivery-updates", body, { headers: { "x-api-key": token } }).catch((e: any) => e.response)

    describe("delivery estimate", () => {
      const estimate = (pincode: string) =>
        api.get(`/store/delivery-estimate?pincode=${pincode}`, { headers: shop.store }).catch((e: any) => e.response)

      it("tells if, how and when a pincode is served", async () => {
        const ok = await estimate("431203")
        expect(ok.data).toMatchObject({ serviceable: true, cod: true, checked: true })
        expect(ok.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect((await estimate("800001")).data).toMatchObject({ serviceable: true, cod: false })
        expect((await estimate("900001")).data).toMatchObject({ serviceable: false, cod: false })
        expect((await estimate("12345")).status).toBe(400)
      })

      async function cartTo(pincode: string) {
        const ready = await shop.readyCart(shop.cheap)
        await api.post(`/store/carts/${ready.cartId}`, { shipping_address: { ...ADDRESS, postal_code: pincode } }, { headers: ready.customer })
        return ready
      }

      it("refuses cash on delivery where couriers cannot collect cash", async () => {
        const { cartId, customer } = await cartTo("800001")
        const res = await api.post("/store/cod/request", { cart_id: cartId }, { headers: customer }).catch((e: any) => e.response)
        expect(res.status).toBe(400)
        expect(res.data.type).toBe("cod_unavailable")
      })

      it("refuses orders to pincodes no courier serves, before any payment", async () => {
        const { cartId, customer } = await cartTo("900001")
        const { data } = await api.post("/store/payment-collections", { cart_id: cartId }, { headers: customer })
        const { data: withSession } = await api.post(
          `/store/payment-collections/${data.payment_collection.id}/payment-sessions`,
          { provider_id: "pp_razorpay_razorpay" },
          { headers: customer }
        )
        razorpay.state.pay(withSession.payment_collection.payment_sessions[0].data.razorpay_order_id)
        const result = await shop.complete(cartId, customer).catch((e: any) => e.response.data)
        expect(result.type).not.toBe("order")
        expect(JSON.stringify(result)).toContain("do not deliver to this pincode")
        // The payment was never captured (Razorpay refunds it by itself)
        expect([...razorpay.state.payments.values()].every((p: any) => p.status === "authorized")).toBe(true)
      })
    })

    describe("courier booking", () => {
      it("books a COD parcel as COD with the amount to collect", async () => {
        const { order } = await shop.placeCodOrder(shop.cheap, 2)
        const fulfillment = await ship(order.id)

        expect(fulfillment.data).toMatchObject({ payment_method: "COD", courier: "Fast Courier", pickup_requested: true })
        expect(fulfillment.labels[0].tracking_number).toBe(fulfillment.data.awb)
        expect(fulfillment.labels[0].tracking_url).toContain(fulfillment.data.awb)

        const booked = shiprocket.state.orders.get(fulfillment.data.shiprocket_order_id)
        expect(booked.input).toMatchObject({
          payment_method: "COD",
          billing_pincode: "431203",
          billing_phone: "9876543210",
          billing_customer_name: "आशा",
          pickup_location: "Primary",
        })
        expect(booked.input.order_id.startsWith(`${order.id}-`)).toBe(true)
        expect(booked.input.sub_total + booked.input.shipping_charges).toBe(order.total)
        expect(booked.input.order_items[0]).toMatchObject({ units: 2, hsn: expect.any(String) })
        expect(booked.input.weight).toBeGreaterThanOrEqual(0.5)
      })

      it("refuses to book when the payment method is not recorded", async () => {
        const { order } = await shop.placeCodOrder()
        await waitFor(async () => (await orderWithFulfillments(order.id)).metadata?.payment_method)
        await getContainer().resolve(Modules.ORDER).updateOrders([{ id: order.id, metadata: { payment_method: "" } }])
        const fresh = await orderWithFulfillments(order.id)
        const booked = shiprocket.state.orders.size
        const error = await createOrderFulfillmentWorkflow(getContainer())
          .run({ input: { order_id: order.id, items: fresh.items.map((i: any) => ({ id: i.id, quantity: i.quantity })) } })
          .then(() => null, (e: any) => e)
        expect(String(error?.message)).toMatch(/payment method/)
        expect(shiprocket.state.orders.size).toBe(booked)
      })
    })

    describe("tracking updates", () => {
      it("needs the webhook token", async () => {
        expect((await hook({ awb: "X", current_status: "DELIVERED" }, "wrong")).status).toBe(401)
      })

      it("moves the order through shipped and delivered, and marks COD money collected", async () => {
        const { order, customer } = await shop.placeCodOrder()
        const fulfillment = await ship(order.id)
        const awb = fulfillment.data.awb

        expect((await hook({ awb, current_status: "IN TRANSIT", order_id: fulfillment.data.channel_order_id })).status).toBe(200)
        let current = await orderWithFulfillments(order.id)
        expect(current.fulfillments[0].shipped_at).toBeTruthy()
        expect(current.metadata.tracking).toMatchObject({
          stage: "shipped",
          status: "IN TRANSIT",
          awb,
          courier: "Fast Courier",
          url: `https://shiprocket.co/tracking/${awb}`,
        })
        expect(current.payment_collections[0].payments[0].captured_at).toBeFalsy()

        // The customer (and only they) can read the progress
        const { data: mine } = await api.get(`/store/orders/${order.id}/tracking`, { headers: customer })
        expect(mine.tracking).toMatchObject({ stage: "shipped", awb })
        const stranger = await shop.readyCart(shop.cheap)
        expect((await api.get(`/store/orders/${order.id}/tracking`, { headers: stranger.customer }).catch((e: any) => e.response)).status).toBe(404)

        // Found by tracking number when the update has no order id
        await hook({ awb, current_status: "OUT FOR DELIVERY" })
        await hook({ awb, current_status: "DELIVERED" })
        current = await orderWithFulfillments(order.id)
        expect(current.fulfillments[0].delivered_at).toBeTruthy()
        expect(current.metadata.tracking.stage).toBe("delivered")
        expect(current.metadata.tracking.history.map((h: any) => h.stage)).toEqual(["shipped", "out_for_delivery", "delivered"])
        expect(current.payment_collections[0].payments[0].captured_at).toBeTruthy()

        // Repeats and unknown statuses are harmless
        expect((await hook({ awb, current_status: "DELIVERED" })).status).toBe(200)
        expect((await hook({ awb, current_status: "SOMETHING NEW" })).status).toBe(200)
        expect((await hook({ awb: "UNKNOWN", current_status: "DELIVERED" })).status).toBe(200)
      })
    })
    describe("cancel before dispatch", () => {
      const cancel = (orderId: string, headers: Record<string, string>, reason = "changed_mind") =>
        api.post(`/store/orders/${orderId}/cancel`, { reason }, { headers }).catch((e: any) => e.response)

      async function placeOnlineOrder() {
        const ready = await shop.readyCart(shop.expensive)
        const { data } = await api.post("/store/payment-collections", { cart_id: ready.cartId }, { headers: ready.customer })
        const { data: withSession } = await api.post(
          `/store/payment-collections/${data.payment_collection.id}/payment-sessions`,
          { provider_id: "pp_razorpay_razorpay" },
          { headers: ready.customer }
        )
        const session = withSession.payment_collection.payment_sessions[0]
        const payment = razorpay.state.pay(session.data.razorpay_order_id)
        const result = await shop.complete(ready.cartId, ready.customer)
        expect(result.type).toBe("order")
        return { ...ready, order: result.order, payment }
      }

      const status = async (orderId: string) =>
        ((await query().graph({ entity: "order", fields: ["status", "metadata"], filters: { id: orderId } })).data[0] as any)

      it("cancels an unshipped COD order", async () => {
        const { order, customer } = await shop.placeCodOrder()
        expect((await cancel(order.id, customer, "bad-reason")).status).toBe(400)
        expect((await cancel(order.id, customer)).status).toBe(200)
        expect(await status(order.id)).toMatchObject({ status: "canceled", metadata: { cancel_reason: "changed_mind" } })
      })

      it("cancels the courier booking and refunds an online payment in full", async () => {
        const { order, customer, payment } = await placeOnlineOrder()
        const fulfillment = await ship(order.id)
        expect((await cancel(order.id, customer)).status).toBe(200)
        expect((await status(order.id)).status).toBe("canceled")
        expect(shiprocket.state.cancelled).toContain(fulfillment.data.shiprocket_order_id)
        expect(razorpay.state.refunds).toContainEqual({ payment_id: payment.id, amount: payment.amount })
      })

      it("refuses once the parcel is shipped, and for other customers", async () => {
        const { order, customer } = await shop.placeCodOrder()
        const other = await shop.readyCart(shop.cheap)
        expect((await cancel(order.id, other.customer)).status).toBe(404)

        const fulfillment = await ship(order.id)
        await hook({ awb: fulfillment.data.awb, current_status: "PICKED UP", order_id: fulfillment.data.channel_order_id })
        const res = await cancel(order.id, customer)
        expect(res.status).toBe(409)
        expect(res.data.type).toBe("already_shipped")
      })
    })
  },
})
