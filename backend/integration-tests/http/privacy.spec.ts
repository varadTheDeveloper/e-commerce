import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { shipOrder, shopHelpers } from "./helpers"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startFakeShiprocket, EMAIL, PASSWORD } = require("../fake-shiprocket")

jest.setTimeout(240 * 1000)

process.env.SMS_PROVIDER = "console"
process.env.OTP_TEST_CODE = "123456"
process.env.SHIPROCKET_EMAIL = EMAIL
process.env.SHIPROCKET_PASSWORD = PASSWORD
process.env.SHIPROCKET_WEBHOOK_TOKEN = "hook-token"

let shiprocket: any
beforeAll(async () => {
  shiprocket = await startFakeShiprocket()
  process.env.SHIPROCKET_API_BASE = shiprocket.url
})
afterAll(async () => {
  await shiprocket.close()
})

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    const shop = shopHelpers(api, getContainer)
    beforeEach(async () => {
      await shop.seed()
    })
    const call = (p: Promise<any>) => p.catch((e: any) => e.response)

    it("delete my account: refused while an order is on its way, then personal details removed, orders kept", async () => {
      const { order, customer, phone } = await shop.placeCodOrder()
      const customerId = (await api.get("/store/customers/me", { headers: customer })).data.customer.id
      await api.post("/store/customers/me/addresses", { address_1: "12, Shivaji Nagar", city: "Jalna", postal_code: "431203", country_code: "in" }, { headers: customer })
      await api.post("/store/customers/me/wishlist", { product_ids: [order.items[0].product_id] }, { headers: customer })

      const early = await call(api.post("/store/customers/me/delete", {}, { headers: customer }))
      expect(early.status).toBe(409)
      expect(early.data).toMatchObject({ type: "open_orders", orders: 1 })

      await shipOrder(api, getContainer, order.id, true)
      const done = await api.post("/store/customers/me/delete", {}, { headers: customer })
      expect(done.data.deleted).toBe(true)

      const after = await getContainer().resolve(Modules.CUSTOMER).retrieveCustomer(customerId, { relations: ["addresses"] })
      expect(after).toMatchObject({ first_name: "Deleted", phone: null, email: null, addresses: [] })
      expect(after.metadata).toMatchObject({ deleted_at: expect.any(String) })
      expect(after.metadata?.privacy_consent).toBeUndefined()
      expect(await getContainer().resolve("wishlist").listWishlistItems({ customer_id: customerId })).toHaveLength(0)
      // The order (a tax record) stays
      expect((await getContainer().resolve(Modules.ORDER).retrieveOrder(order.id)).id).toBe(order.id)

      // The same phone number now starts a new account
      await api.post("/store/otp/request", { phone }, { headers: shop.store })
      const login = await api.post("/auth/customer/phone-otp", { phone, code: "123456" })
      const me = await call(api.get("/store/customers/me", { headers: { ...shop.store, authorization: `Bearer ${login.data.token}` } }))
      expect(me.status).toBe(401)
    })

    it("staff login: blocked after 10 wrong passwords, right ones never count", async () => {
      const container = getContainer()
      const user = await container.resolve(Modules.USER).createUsers({ email: "boss@example.com" })
      const { authIdentity } = await container
        .resolve(Modules.AUTH)
        .register("emailpass", { body: { email: "boss@example.com", password: "right-password-1" } } as any)
      await container.resolve(Modules.AUTH).updateAuthIdentities({ id: authIdentity!.id, app_metadata: { user_id: user.id } })
      const login = (password: string) => call(api.post("/auth/user/emailpass", { email: "boss@example.com", password }))

      for (let i = 0; i < 12; i++) expect((await login("right-password-1")).status).toBe(200)
      for (let i = 0; i < 10; i++) expect((await login("wrong-guess")).status).toBe(401)
      const blocked = await login("right-password-1")
      expect(blocked.status).toBe(429)
      expect(blocked.data.type).toBe("too_many")
    })

    it("delete my account needs a login", async () => {
      expect((await call(api.post("/store/customers/me/delete", {}, { headers: shop.store }))).status).toBe(401)
    })
  },
})
