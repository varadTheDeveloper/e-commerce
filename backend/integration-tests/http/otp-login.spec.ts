import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

jest.setTimeout(90 * 1000)

// The console SMS provider with a fixed test code (never allowed in production).
process.env.SMS_PROVIDER = "console"
process.env.OTP_TEST_CODE = "123456"

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>

    beforeEach(async () => {
      const apiKeys = getContainer().resolve(Modules.API_KEY)
      const [key] = await apiKeys.createApiKeys([{ title: "test", type: "publishable", created_by: "test" }])
      headers = { "x-publishable-api-key": key.token }
    })

    const request = (phone: string) =>
      api.post("/store/otp/request", { phone }, { headers }).catch((e) => e.response)
    const login = (phone: string, code: string) =>
      api.post("/auth/customer/phone-otp", { phone, code }).catch((e) => e.response)

    it("signs up a new number and logs it in again later", async () => {
      expect((await request("98765 43210")).status).toBe(200)

      const first = await login("9876543210", "123456")
      expect(first.status).toBe(200)
      const signup = await api.post(
        "/store/otp/account",
        { first_name: "Asha" },
        { headers: { ...headers, authorization: `Bearer ${first.data.token}` } }
      )
      expect(signup.data.customer).toMatchObject({ first_name: "Asha", phone: "+919876543210", email: null })

      // Next day: same number, new code, straight into the account
      const container = getContainer()
      const auth = container.resolve(Modules.AUTH)
      const [identity] = await auth.listProviderIdentities({ entity_id: "+919876543210" })
      await auth.updateProviderIdentities([
        { id: identity.id, provider_metadata: { ...identity.provider_metadata, last_sent_at: 0, sends: [] } },
      ])
      expect((await request("+919876543210")).status).toBe(200)
      const again = await login("+91 98765 43210", "123456")
      const me = await api.get("/store/customers/me", {
        headers: { ...headers, authorization: `Bearer ${again.data.token}` },
      })
      expect(me.data.customer.id).toBe(signup.data.customer.id)
    })

    it("refuses bad numbers, wrong codes, reused codes and fast resends", async () => {
      expect((await request("12345 67890")).status).toBe(400)
      expect((await request("9123456780")).status).toBe(200)
      expect((await request("9123456780")).status).toBe(429)

      expect((await login("9123456780", "000000")).status).toBe(401)
      expect((await login("9123456780", "123456")).status).toBe(200)
      expect((await login("9123456780", "123456")).status).toBe(401)
    })

    it("locks the code after 5 wrong tries", async () => {
      await request("9000000001")
      for (let i = 0; i < 5; i++) {
        expect((await login("9000000001", "999999")).status).toBe(401)
      }
      expect((await login("9000000001", "123456")).status).toBe(401)
    })

    it("takes the phone number from the verified login, not the request", async () => {
      await request("9000000002")
      const { data } = await login("9000000002", "123456")
      const res = await api
        .post("/store/otp/account", { first_name: "X", phone: "+919999999999" }, {
          headers: { ...headers, authorization: `Bearer ${data.token}` },
        })
        .catch((e) => e.response)
      expect(res.status).toBe(400)
    })
  },
})
