import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import { shopHelpers, waitFor } from "./helpers"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startFakeShiprocket, EMAIL, PASSWORD } = require("../fake-shiprocket")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startFakeMessaging } = require("../fake-messaging")

jest.setTimeout(180 * 1000)

// Login codes and update SMS both through (fake) Message Central; emails through (fake) Resend
process.env.SMS_PROVIDER = "messagecentral"
process.env.MESSAGECENTRAL_CUSTOMER_ID = "C-TEST"
process.env.MESSAGECENTRAL_PASSWORD = "test-password"
delete process.env.OTP_TEST_CODE
process.env.SMS_ORDER_UPDATES = "true"
process.env.MESSAGECENTRAL_SENDER_ID = "VASTRA"
process.env.MESSAGECENTRAL_ENTITY_ID = "1101000000000000001"
process.env.SMS_TEMPLATE_IDS = JSON.stringify({ "placed.mr": "T-PLACED-MR", "shipped.en": "T-SHIPPED-EN" })
process.env.RESEND_API_KEY = "re_test"
process.env.EMAIL_FROM = "Vastra <orders@example.com>"
process.env.ORDER_ALERT_EMAIL = "shop@example.com"
process.env.STOREFRONT_URL = "https://shop.example.com"
process.env.SHIPROCKET_EMAIL = EMAIL
process.env.SHIPROCKET_PASSWORD = PASSWORD
process.env.SHIPROCKET_WEBHOOK_TOKEN = "hook-token"

let messaging: any
let shiprocket: any
beforeAll(async () => {
  messaging = await startFakeMessaging()
  shiprocket = await startFakeShiprocket()
  process.env.RESEND_API_BASE = messaging.url
  process.env.MESSAGECENTRAL_BASE_URL = messaging.url
  process.env.SHIPROCKET_API_BASE = shiprocket.url
})
afterAll(async () => {
  await messaging.close()
  await shiprocket.close()
})

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    const shop = shopHelpers(api, getContainer)
    beforeEach(() => shop.seed())

    const emailsTo = (to: string) => messaging.state.emails.filter((e: any) => e.to.includes(to))

    it("emails and texts the customer at each step, in their language, and alerts the shop", async () => {
      const { order, phone } = await shop.placeCodOrder(shop.cheap, 1, { email: "asha@example.com" })
      const number = order.display_id

      // Placed (Marathi by default): customer email, shop alert, SMS with the registered template
      const placed = await waitFor(async () => emailsTo("asha@example.com")[0])
      expect(placed.subject).toBe(`ऑर्डर #${number} नोंदवली – Vastra`)
      expect(placed.text).toContain(`https://shop.example.com/mr/account/orders/details/${order.id}`)
      expect(placed.html).toContain("रोख किंवा UPI")
      const alert = await waitFor(async () => emailsTo("shop@example.com")[0])
      expect(alert.subject).toContain(`New order #${number}`)
      const sms = await waitFor(async () => messaging.state.sms.find((s: any) => s.templateId === "T-PLACED-MR"))
      expect(sms).toMatchObject({ mobileNumber: phone, senderId: "VASTRA", entityId: "1101000000000000001", messageType: "TRANSACTION" })
      expect(sms.message).toBe(
        `तुमची Vastra ऑर्डर #${number} (Rs.${order.total}) नोंदवली आहे. तपशील: https://shop.example.com/mr/account/orders/details/${order.id}`
      )

      // Shipped: email with the tracking link; no SMS because "shipped.mr" is not registered
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const orderNow = async () =>
        (await query.graph({ entity: "order", fields: ["items.*", "metadata", "fulfillments.data"], filters: { id: order.id } })).data[0] as any
      const ready = await waitFor(async () => {
        const o = await orderNow()
        return o.metadata?.payment_method ? o : null
      })
      await createOrderFulfillmentWorkflow(getContainer()).run({
        input: { order_id: order.id, items: ready.items.map((i: any) => ({ id: i.id, quantity: i.quantity })) },
      })
      const awb = (await orderNow()).fulfillments[0].data.awb
      await api.post("/hooks/delivery-updates", { awb, current_status: "IN TRANSIT" }, { headers: { "x-api-key": "hook-token" } })
      const shipped = await waitFor(async () => emailsTo("asha@example.com").find((e: any) => e.subject.includes("वाटेवर")))
      expect(shipped.text).toContain(`https://shiprocket.co/tracking/${awb}`)
      expect(shipped.text).toContain(awb)
      expect(messaging.state.sms).toHaveLength(1)

      await api.post("/hooks/delivery-updates", { awb, current_status: "DELIVERED" }, { headers: { "x-api-key": "hook-token" } })
      await waitFor(async () => emailsTo("asha@example.com").find((e: any) => e.subject.includes("डिलिव्हर")))
    })

    it("tells the customer about a cancellation, in the language they shopped in", async () => {
      const { order, customer } = await shop.placeCodOrder(shop.cheap, 1, { email: "ravi@example.com", locale: "hi-IN" })
      await api.post(`/store/orders/${order.id}/cancel`, { reason: "changed_mind" }, { headers: customer })
      const email = await waitFor(async () => emailsTo("ravi@example.com").find((e: any) => e.subject.includes("रद्द")))
      expect(email.subject).toBe(`ऑर्डर #${order.display_id} रद्द हो गया – Vastra`)
      expect(email.text).toContain("आपको कुछ भी भुगतान नहीं करना है")
      expect(email.text).toContain("/hi/account/orders/details/")
    })
  },
})
