import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createServer, Server } from "http"
import { AddressInfo } from "net"
import { publishableHeaders } from "./helpers"

jest.setTimeout(90 * 1000)

// Login through Message Central, against a fake of their API on localhost.
// The fake makes code 246810 for every number and remembers its verification ids.
const CODE = "246810"
const fake = {
  sends: [] as string[],
  checks: 0,
  down: false,
  verified: new Set<string>(),
}

let server: Server

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://fake")
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" })
      res.end(JSON.stringify(body))
    }
    if (url.pathname === "/auth/v1/authentication/token") {
      return url.searchParams.get("customerId") === "C-TEST" ? reply(200, { status: 200, token: "tok" }) : reply(401, {})
    }
    if (req.headers.authtoken !== "tok") {
      return reply(401, {})
    }
    if (url.pathname === "/verification/v3/send" && req.method === "POST") {
      fake.sends.push(url.searchParams.get("mobileNumber") ?? "")
      return reply(200, { responseCode: 200, message: "SUCCESS", data: { verificationId: `v${fake.sends.length}` } })
    }
    if (url.pathname === "/verification/v3/validateOtp") {
      fake.checks++
      if (fake.down) return reply(500, { responseCode: 500 })
      const id = url.searchParams.get("verificationId") ?? ""
      if (fake.verified.has(id)) return reply(400, { responseCode: 703 })
      if (url.searchParams.get("code") !== CODE) return reply(400, { responseCode: 702 })
      fake.verified.add(id)
      return reply(200, { responseCode: 200, data: { verificationStatus: "VERIFICATION_COMPLETED" } })
    }
    reply(404, {})
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  process.env.MESSAGECENTRAL_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

process.env.SMS_PROVIDER = "messagecentral"
process.env.MESSAGECENTRAL_CUSTOMER_ID = "C-TEST"
process.env.MESSAGECENTRAL_PASSWORD = "test-password"
delete process.env.OTP_TEST_CODE

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>

    beforeEach(async () => {
      headers = await publishableHeaders(getContainer)
      fake.down = false
    })

    const request = (phone: string) =>
      api.post("/store/otp/request", { phone }, { headers }).catch((e) => e.response)
    const login = (phone: string, code: string) =>
      api.post("/auth/customer/phone-otp", { phone, code }).catch((e) => e.response)

    it("sends through Message Central and logs in with their code", async () => {
      expect((await request("9811111111")).status).toBe(200)
      expect(fake.sends).toContain("9811111111")

      expect((await login("9811111111", "000000")).status).toBe(401)
      const ok = await login("9811111111", CODE)
      expect(ok.status).toBe(200)
      expect(typeof ok.data.token).toBe("string")

      // Used once: the same code does not log in again
      expect((await login("9811111111", CODE)).status).toBe(401)
    })

    it("does not count a wrong try when Message Central is down", async () => {
      await request("9822222222")
      fake.down = true
      for (let i = 0; i < 6; i++) {
        expect((await login("9822222222", CODE)).status).toBe(401)
      }
      fake.down = false
      expect((await login("9822222222", CODE)).status).toBe(200)
    })

    it("locks after 5 wrong codes without asking Message Central again", async () => {
      await request("9833333333")
      for (let i = 0; i < 5; i++) {
        expect((await login("9833333333", "999999")).status).toBe(401)
      }
      const before = fake.checks
      expect((await login("9833333333", CODE)).status).toBe(401)
      expect(fake.checks).toBe(before)
    })

    it("still makes people wait between codes", async () => {
      expect((await request("9844444444")).status).toBe(200)
      expect((await request("9844444444")).status).toBe(429)
      expect(fake.sends.filter((n) => n === "9844444444")).toHaveLength(1)
    })
  },
})
