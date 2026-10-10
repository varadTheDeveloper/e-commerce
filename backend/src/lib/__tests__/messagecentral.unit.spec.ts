import { SmsConfig, smsConfigFromEnv } from "../sms"
import { checkMessageCentralOtp, resetMessageCentralToken, sendMessageCentralOtp } from "../sms/messagecentral"

const config: SmsConfig = {
  provider: "messagecentral",
  messageCentralCustomerId: "C-123",
  messageCentralPassword: "pass word",
}

const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

/** A fake fetch: token calls get a token, other calls get `replies` in order. */
function fakeFetch(...replies: ReturnType<typeof json>[]) {
  let tokens = 0
  return jest.fn(async (url: URL) => {
    if (url.pathname === "/auth/v1/authentication/token") {
      tokens++
      return json(200, { status: 200, token: `tok-${tokens}` })
    }
    const reply = replies.shift()
    if (!reply) throw new Error("no reply left")
    return reply
  })
}

beforeEach(() => resetMessageCentralToken())

describe("Message Central", () => {
  it("is chosen with SMS_PROVIDER=messagecentral", () => {
    expect(
      smsConfigFromEnv({ SMS_PROVIDER: "messagecentral", MESSAGECENTRAL_CUSTOMER_ID: "C", MESSAGECENTRAL_PASSWORD: "p" })
    ).toMatchObject({ provider: "messagecentral", messageCentralCustomerId: "C", messageCentralPassword: "p" })
    expect(smsConfigFromEnv({ SMS_PROVIDER: "other" }).provider).toBe("console")
  })

  it("logs in, sends a 6-digit code to the number and returns the verification id", async () => {
    const fetchMock = fakeFetch(json(200, { responseCode: 200, message: "SUCCESS", data: { verificationId: 4711 } }))
    expect(await sendMessageCentralOtp("+919876543210", config, fetchMock as any)).toBe("4711")

    const [tokenUrl] = fetchMock.mock.calls[0] as any[]
    expect(tokenUrl.origin).toBe("https://cpaas.messagecentral.com")
    expect(tokenUrl.searchParams.get("customerId")).toBe("C-123")
    expect(tokenUrl.searchParams.get("key")).toBe(Buffer.from("pass word").toString("base64"))

    const [sendUrl, init] = fetchMock.mock.calls[1] as any[]
    expect(sendUrl.pathname).toBe("/verification/v3/send")
    expect(Object.fromEntries(sendUrl.searchParams)).toEqual({
      countryCode: "91",
      flowType: "SMS",
      mobileNumber: "9876543210",
      otpLength: "6",
    })
    expect(init.method).toBe("POST")
    expect(init.headers.authToken).toBe("tok-1")
  })

  it("reuses the token, and gets a new one once when it is refused", async () => {
    const ok = () => json(200, { responseCode: 200, data: { verificationId: "1" } })
    const fetchMock = fakeFetch(ok(), json(401, {}), ok())
    await sendMessageCentralOtp("+919876543210", config, fetchMock as any)
    await sendMessageCentralOtp("+919876543210", config, fetchMock as any)
    const paths = fetchMock.mock.calls.map(([u]: any) => u.pathname)
    expect(paths).toEqual([
      "/auth/v1/authentication/token",
      "/verification/v3/send",
      "/verification/v3/send",
      "/auth/v1/authentication/token",
      "/verification/v3/send",
    ])
    expect((fetchMock.mock.calls[4] as any)[1].headers.authToken).toBe("tok-2")
  })

  it("reports a failed send without the number", async () => {
    const fetchMock = fakeFetch(json(400, { responseCode: 511, message: "INVALID_COUNTRY_CODE", data: { mobileNumber: "9876543210" } }))
    const error = await sendMessageCentralOtp("+919876543210", config, fetchMock as any).catch((e) => e)
    expect(error.message).toBe("Message Central did not send the SMS (HTTP 400, code 511)")
  })

  it("reports a refused login without the reply", async () => {
    const fetchMock = jest.fn(async () => json(401, { token: "" }))
    await expect(sendMessageCentralOtp("+919876543210", config, fetchMock as any)).rejects.toThrow("refused the login (HTTP 401)")
  })

  it("needs its keys", async () => {
    await expect(sendMessageCentralOtp("+919876543210", { provider: "messagecentral" })).rejects.toThrow(
      "MESSAGECENTRAL_CUSTOMER_ID"
    )
  })

  it("checks codes", async () => {
    const check = async (status: number, body: unknown) =>
      checkMessageCentralOtp("4711", "123456", config, fakeFetch(json(status, body)) as any)

    expect(await check(200, { responseCode: 200, data: { verificationStatus: "VERIFICATION_COMPLETED" } })).toBe("ok")
    expect(await check(400, { responseCode: 702, message: "WRONG_OTP_PROVIDED" })).toBe("wrong")
    expect(await check(400, { responseCode: 703 })).toBe("wrong")
    expect(await check(400, { responseCode: 705 })).toBe("expired")
    expect(await check(400, { responseCode: 800 })).toBe("expired")
    await expect(check(500, { responseCode: 500 })).rejects.toThrow("could not check the code (HTTP 500, code 500)")
    await expect(check(200, { responseCode: 200, data: { verificationStatus: "VERIFICATION_FAILED" } })).rejects.toThrow()
  })

  it("sends the id and code to the check", async () => {
    const fetchMock = fakeFetch(json(200, { responseCode: 200, data: { verificationStatus: "VERIFICATION_COMPLETED" } }))
    await checkMessageCentralOtp("4711", "123456", config, fetchMock as any)
    const [url, init] = fetchMock.mock.calls[1] as any[]
    expect(url.pathname).toBe("/verification/v3/validateOtp")
    expect(Object.fromEntries(url.searchParams)).toEqual({ verificationId: "4711", code: "123456", flowType: "SMS" })
    expect(init.method).toBe("GET")
  })
})
