import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import { shipOrder, shopHelpers, waitFor } from "./helpers"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startFakeShiprocket, EMAIL, PASSWORD } = require("../fake-shiprocket")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startFakeRazorpay, KEY_ID, KEY_SECRET } = require("../fake-razorpay")

jest.setTimeout(240 * 1000)

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

// A tiny valid JPEG (just the parts the upload check reads)
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1), Buffer.from([0xff, 0xd9])])

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    const shop = shopHelpers(api, getContainer)
    let admin: Record<string, string>

    beforeEach(async () => {
      await shop.seed()
      // An admin user, logged in like staff in the admin panel
      const container = getContainer()
      const user = await container.resolve(Modules.USER).createUsers({ email: "staff@example.com" })
      const { authIdentity } = await container
        .resolve(Modules.AUTH)
        .register("emailpass", { body: { email: "staff@example.com", password: "staff-password-1" } } as any)
      await container.resolve(Modules.AUTH).updateAuthIdentities({ id: authIdentity!.id, app_metadata: { user_id: user.id } })
      const { data } = await api.post("/auth/user/emailpass", { email: "staff@example.com", password: "staff-password-1" })
      admin = { authorization: `Bearer ${data.token}` }
    })

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const call = (p: Promise<any>) => p.catch((e: any) => e.response)

    async function stockOf(variantId: string) {
      const { data } = await query().graph({
        entity: "variant",
        fields: ["inventory_items.inventory.location_levels.stocked_quantity", "inventory_items.inventory.location_levels.reserved_quantity"],
        filters: { id: variantId },
      })
      const level = (data[0] as any).inventory_items[0].inventory.location_levels[0]
      return { stocked: Number(level.stocked_quantity), reserved: Number(level.reserved_quantity) }
    }

    async function deliveredCodOrder() {
      const placed = await shop.placeCodOrder(shop.cheap)
      await shipOrder(api, getContainer, placed.order.id, true)
      return placed
    }

    const returnsOf = (orderId: string, headers: Record<string, string>) =>
      api.get(`/store/orders/${orderId}/returns`, { headers }).then((r: any) => r.data)

    async function uploadPhoto(headers: Record<string, string>, bytes = JPEG) {
      const form = new FormData()
      form.append("photo", new Blob([bytes]), "photo.jpg")
      return call(api.post("/store/returns/photos", form, { headers }))
    }

    it("COD return: request with UPI refund, approve (pickup), picked up, received (stock back), refund sent", async () => {
      const { order, customer } = await deliveredCodOrder()
      const item = order.items[0]
      const info = await returnsOf(order.id, customer)
      expect(info.open).toBe(true)
      expect(info.cod).toBe(true)
      expect(info.items[0]).toMatchObject({ line_item_id: item.id, returnable: true, quantity: 1 })
      expect(info.items[0].exchange_options.length).toBeGreaterThan(0)

      const ask = (body: any) => call(api.post(`/store/orders/${order.id}/returns`, body, { headers: customer }))
      const base = { type: "return", items: [{ line_item_id: item.id, quantity: 1, reason: "too_small" }] }
      expect((await ask(base)).data.type).toBe("refund_details")
      expect((await ask({ ...base, refund: { method: "upi", upi_id: "not-an-upi" } })).data.type).toBe("refund_details")
      expect((await ask({ ...base, items: [{ ...base.items[0], reason: "damaged" }], refund: { method: "upi", upi_id: "asha@okaxis" } })).data.type).toBe(
        "photo_required"
      )
      const created = await ask({ ...base, refund: { method: "upi", upi_id: "asha@okaxis" } })
      expect(created.status).toBe(200)
      expect(created.data.request).toMatchObject({ type: "return", status: "requested" })
      expect(created.data.request.refund_details).toBeUndefined()
      // The same item cannot be asked for twice
      expect((await ask({ ...base, refund: { method: "upi", upi_id: "asha@okaxis" } })).data.type).toBe("not_returnable")

      // Staff
      expect((await call(api.get("/admin/return-requests"))).status).toBe(401)
      const list = await api.get("/admin/return-requests?status=requested", { headers: admin })
      expect(list.data.return_requests[0]).toMatchObject({ order_number: order.display_id, refund_to: "UPI as••••@okaxis", refund_amount: Number(item.total) })
      const id = created.data.request.id
      const approved = await api.post(`/admin/return-requests/${id}/approve`, {}, { headers: admin })
      expect(approved.data.return_request).toMatchObject({ status: "approved", pickup: { courier: "Fast Courier" } })
      const awb = approved.data.return_request.pickup_awb
      expect(awb).toMatch(/^RAWB/)
      const booked = [...shiprocket.state.orders.values()].find((o: any) => o.awb === awb)
      expect(booked.input).toMatchObject({ pickup_pincode: "431203", shipping_pincode: "431203", payment_method: "PREPAID", sub_total: Number(item.total) })

      await api.post("/hooks/delivery-updates", { awb, current_status: "PICKED UP" }, { headers: { "x-api-key": "hook-token" } })
      expect((await returnsOf(order.id, customer)).requests[0].status).toBe("picked_up")

      const before = await stockOf(item.variant_id)
      const received = await api.post(`/admin/return-requests/${id}/receive`, {}, { headers: admin })
      expect(received.data.return_request.status).toBe("refund_due")
      expect((await stockOf(item.variant_id)).stocked).toBe(before.stocked + 1)

      const refunded = await api.post(`/admin/return-requests/${id}/refunded`, { reference: "UPI ref 123456" }, { headers: admin })
      expect(refunded.data.return_request).toMatchObject({ status: "refunded", refund_details: null })
      expect(refunded.data.return_request.refund_reference).toContain("UPI ref 123456")
    })

    it("online return: refunded through Razorpay when received", async () => {
      const ready = await shop.readyCart(shop.expensive)
      const { data } = await api.post("/store/payment-collections", { cart_id: ready.cartId }, { headers: ready.customer })
      const { data: withSession } = await api.post(
        `/store/payment-collections/${data.payment_collection.id}/payment-sessions`,
        { provider_id: "pp_razorpay_razorpay" },
        { headers: ready.customer }
      )
      const payment = razorpay.state.pay(withSession.payment_collection.payment_sessions[0].data.razorpay_order_id)
      const { order } = await shop.complete(ready.cartId, ready.customer)
      await shipOrder(api, getContainer, order.id, true)

      const item = order.items[0]
      const created = await api.post(
        `/store/orders/${order.id}/returns`,
        { type: "return", items: [{ line_item_id: item.id, quantity: 1, reason: "changed_mind" }] },
        { headers: ready.customer }
      )
      const id = created.data.request.id
      await api.post(`/admin/return-requests/${id}/approve`, {}, { headers: admin })
      const received = await api.post(`/admin/return-requests/${id}/receive`, {}, { headers: admin })
      expect(received.data.return_request.status).toBe("refunded")
      expect(razorpay.state.refunds).toContainEqual({ payment_id: payment.id, amount: Math.round(Number(item.total) * 100) })
    })

    it("exchange: new size held on approval, old size back in stock, new parcel booked prepaid", async () => {
      const { order, customer } = await deliveredCodOrder()
      const item = order.items[0]
      const info = await returnsOf(order.id, customer)
      const size = info.items[0].exchange_options.find((o: any) => o.in_stock)
      const newBefore = await stockOf(size.variant_id)

      const created = await api.post(
        `/store/orders/${order.id}/returns`,
        { type: "exchange", items: [{ line_item_id: item.id, quantity: 1, reason: "too_small", exchange_variant_id: size.variant_id }] },
        { headers: customer }
      )
      const id = created.data.request.id
      await api.post(`/admin/return-requests/${id}/approve`, {}, { headers: admin })
      expect((await stockOf(size.variant_id)).reserved).toBe(newBefore.reserved + 1)

      const oldBefore = await stockOf(item.variant_id)
      const received = await api.post(`/admin/return-requests/${id}/receive`, {}, { headers: admin })
      expect(received.data.return_request.status).toBe("received")
      expect((await stockOf(item.variant_id)).stocked).toBe(oldBefore.stocked + 1)

      // Staff ship the new size from the order page
      const { data } = await query().graph({ entity: "order", fields: ["items.*", "fulfillments.id"], filters: { id: order.id } })
      const newItem = (data[0] as any).items.find((i: any) => i.variant_id === size.variant_id)
      expect(newItem.metadata).toMatchObject({ from_exchange: true, return_request_id: id })
      await createOrderFulfillmentWorkflow(getContainer()).run({ input: { order_id: order.id, items: [{ id: newItem.id, quantity: 1 }] } })
      const booked = [...shiprocket.state.orders.values()].pop()
      expect(booked.input.payment_method).toBe("Prepaid")

      await api.post("/hooks/delivery-updates", { awb: booked.awb, current_status: "IN TRANSIT" }, { headers: { "x-api-key": "hook-token" } })
      await waitFor(async () => (await returnsOf(order.id, customer)).requests[0].status === "completed")
      // An exchanged item cannot be exchanged again
      const after = await returnsOf(order.id, customer)
      expect(after.items.find((i: any) => i.line_item_id === newItem.id)).toMatchObject({ returnable: false, reason: "exchange_item" })
    })

    it("staff can reject with a reason; the refund account is forgotten", async () => {
      const { order, customer } = await deliveredCodOrder()
      const created = await api.post(
        `/store/orders/${order.id}/returns`,
        { type: "return", items: [{ line_item_id: order.items[0].id, quantity: 1, reason: "changed_mind" }], refund: { method: "upi", upi_id: "asha@okaxis" } },
        { headers: customer }
      )
      const rejected = await api.post(`/admin/return-requests/${created.data.request.id}/reject`, { reason: "Tags were removed" }, { headers: admin })
      expect(rejected.data.return_request).toMatchObject({ status: "rejected", reject_reason: "Tags were removed", refund_details: null })
      expect((await returnsOf(order.id, customer)).requests[0]).toMatchObject({ status: "rejected", reject_reason: "Tags were removed" })
    })

    it("products marked returnable: false (as typed in the admin) cannot be returned", async () => {
      const { order, customer } = await deliveredCodOrder()
      const { data } = await query().graph({ entity: "variant", fields: ["product_id"], filters: { id: shop.cheap.id } })
      await getContainer().resolve(Modules.PRODUCT).updateProducts((data[0] as any).product_id, { metadata: { returnable: "false" } })

      expect((await returnsOf(order.id, customer)).items[0]).toMatchObject({ returnable: false, reason: "not_returnable" })
      const res = await call(
        api.post(
          `/store/orders/${order.id}/returns`,
          { type: "return", items: [{ line_item_id: order.items[0].id, quantity: 1, reason: "changed_mind" }], refund: { method: "upi", upi_id: "asha@okaxis" } },
          { headers: customer }
        )
      )
      expect(res.data.type).toBe("not_returnable")
    })

    it("only within 7 days of delivery, and not before delivery", async () => {
      const placed = await shop.placeCodOrder(shop.cheap)
      expect((await returnsOf(placed.order.id, placed.customer)).open).toBe(false)

      const { order, customer } = await deliveredCodOrder()
      const { data } = await query().graph({ entity: "order", fields: ["fulfillments.id"], filters: { id: order.id } })
      await getContainer()
        .resolve(Modules.FULFILLMENT)
        .updateFulfillment((data[0] as any).fulfillments[0].id, { delivered_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) })
      expect((await returnsOf(order.id, customer)).open).toBe(false)
      const res = await call(
        api.post(`/store/orders/${order.id}/returns`, { type: "return", items: [{ line_item_id: order.items[0].id, quantity: 1, reason: "changed_mind" }] }, { headers: customer })
      )
      expect(res.data.type).toBe("window_closed")

      const other = await shop.readyCart(shop.cheap)
      expect((await call(api.get(`/store/orders/${order.id}/returns`, { headers: other.customer }))).status).toBe(404)
    })

    it("photos: images only, and only your own", async () => {
      const { order, customer } = await deliveredCodOrder()
      expect((await uploadPhoto(customer, Buffer.from("not an image at all"))).status).toBe(400)
      const photo = await uploadPhoto(customer)
      expect(photo.status).toBe(200)
      const other = await shop.readyCart(shop.cheap)
      const othersPhoto = (await uploadPhoto(other.customer)).data.id

      const ask = (photos: string[]) =>
        call(
          api.post(
            `/store/orders/${order.id}/returns`,
            { type: "return", items: [{ line_item_id: order.items[0].id, quantity: 1, reason: "damaged" }], photos, refund: { method: "upi", upi_id: "asha@okaxis" } },
            { headers: customer }
          )
        )
      expect((await ask([othersPhoto])).data.type).toBe("invalid_photo")
      // At most 20 photos per customer per hour (2 uploaded above)
      for (let i = 0; i < 18; i++) expect((await uploadPhoto(customer)).status).toBe(200)
      expect((await uploadPhoto(customer)).status).toBe(429)
      const ok = await ask([photo.data.id])
      expect(ok.status).toBe(200)
      expect(ok.data.request.photos).toEqual([photo.data.url])
    })
  },
})
