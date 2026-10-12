import type { SmsConfig } from "."

// Message Central VerifyNow (https://cpaas.messagecentral.com).
// They create the 6-digit code, send it from their DLT-approved sender and
// check it. We store only their verification id; our own limits (resend
// wait, hourly cap, 5 wrong tries, 5-minute expiry) still apply on top.
//
// API: GET /auth/v1/authentication/token?customerId&key=<base64 password>
//      POST /verification/v3/send?countryCode=91&flowType=SMS&mobileNumber&otpLength=6
//      GET  /verification/v3/validateOtp?verificationId&code   (header authToken)
// Responses carry a `responseCode`; 702 = wrong code, 705 = expired,
// 703 = already used, 800 = too many tries.

const DEFAULT_BASE_URL = "https://cpaas.messagecentral.com"
const TOKEN_TTL_MS = 30 * 60 * 1000
const TIMEOUT_MS = 10_000

export type CodeCheck = "ok" | "wrong" | "expired"

type Fetch = typeof fetch

let cachedToken: { key: string; token: string; until: number } | null = null

/** Tests only. */
export function resetMessageCentralToken() {
  cachedToken = null
}

function settings(config: SmsConfig) {
  const customerId = config.messageCentralCustomerId
  const password = config.messageCentralPassword
  if (!customerId || !password) {
    throw new Error("MESSAGECENTRAL_CUSTOMER_ID and MESSAGECENTRAL_PASSWORD must be set")
  }
  return { customerId, password, baseUrl: (config.messageCentralBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "") }
}

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function token(config: SmsConfig, fetchImpl: Fetch, fresh = false): Promise<string> {
  const { customerId, password, baseUrl } = settings(config)
  const key = `${baseUrl}|${customerId}`
  if (!fresh && cachedToken && cachedToken.key === key && cachedToken.until > Date.now()) {
    return cachedToken.token
  }
  const url = new URL(`${baseUrl}/auth/v1/authentication/token`)
  url.searchParams.set("customerId", customerId)
  url.searchParams.set("key", Buffer.from(password, "utf8").toString("base64"))
  url.searchParams.set("scope", "NEW")
  url.searchParams.set("country", "91")
  const res = await fetchImpl(url, { headers: { accept: "*/*" }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  const body = await readJson(res)
  if (!res.ok || typeof body?.token !== "string" || !body.token) {
    // Never log the body: it may contain the token
    throw new Error(`Message Central refused the login (HTTP ${res.status})`)
  }
  cachedToken = { key, token: body.token, until: Date.now() + TOKEN_TTL_MS }
  return body.token
}

/** Calls the API with a token; on HTTP 401 gets a new token and tries once more. */
async function call(config: SmsConfig, fetchImpl: Fetch, url: URL, method: "GET" | "POST") {
  for (const fresh of [false, true]) {
    const res = await fetchImpl(url, {
      method,
      headers: { authToken: await token(config, fetchImpl, fresh), accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 401 && !fresh) {
      cachedToken = null
      continue
    }
    return { res, body: await readJson(res) }
  }
  throw new Error("unreachable")
}

/** Asks Message Central to send a code to +91XXXXXXXXXX; returns their verification id. */
export async function sendMessageCentralOtp(phone: string, config: SmsConfig, fetchImpl: Fetch = fetch): Promise<string> {
  const { baseUrl } = settings(config)
  const url = new URL(`${baseUrl}/verification/v3/send`)
  url.searchParams.set("countryCode", "91")
  url.searchParams.set("flowType", "SMS")
  url.searchParams.set("mobileNumber", phone.replace(/^\+91/, ""))
  url.searchParams.set("otpLength", "6")
  const { res, body } = await call(config, fetchImpl, url, "POST")
  const id = body?.data?.verificationId
  if (!res.ok || body?.responseCode !== 200 || (typeof id !== "string" && typeof id !== "number") || String(id) === "") {
    // Status and code only: the body echoes the number
    throw new Error(`Message Central did not send the SMS (HTTP ${res.status}, code ${body?.responseCode ?? "none"})`)
  }
  return String(id)
}

/** Checks a code with Message Central. Throws when their service fails (not counted as a wrong try). */
export async function checkMessageCentralOtp(
  verificationId: string,
  code: string,
  config: SmsConfig,
  fetchImpl: Fetch = fetch
): Promise<CodeCheck> {
  const { baseUrl } = settings(config)
  const url = new URL(`${baseUrl}/verification/v3/validateOtp`)
  url.searchParams.set("verificationId", verificationId)
  url.searchParams.set("code", code)
  url.searchParams.set("flowType", "SMS")
  const { res, body } = await call(config, fetchImpl, url, "GET")
  const responseCode = body?.responseCode ?? body?.data?.responseCode
  if (responseCode === 200 && body?.data?.verificationStatus === "VERIFICATION_COMPLETED") {
    return "ok"
  }
  if (responseCode === 702 || responseCode === 703) {
    return "wrong"
  }
  if (responseCode === 705 || responseCode === 800 || responseCode === 505) {
    return "expired"
  }
  throw new Error(`Message Central could not check the code (HTTP ${res.status}, code ${responseCode ?? "none"})`)
}

/**
 * Sends a text SMS (order updates) with a DLT-registered template through
 * Message Central's MessageNow. `text` must match the template exactly, with
 * its values filled in.
 */
export async function sendMessageCentralSms(
  phone: string,
  text: string,
  dlt: { senderId: string; entityId: string; templateId: string },
  config: SmsConfig,
  fetchImpl: Fetch = fetch
): Promise<void> {
  const { baseUrl } = settings(config)
  const url = new URL(`${baseUrl}/verification/v3/send`)
  url.searchParams.set("countryCode", "91")
  url.searchParams.set("flowType", "SMS")
  url.searchParams.set("type", "SMS")
  url.searchParams.set("messageType", "TRANSACTION")
  url.searchParams.set("mobileNumber", phone.replace(/^\+91/, ""))
  url.searchParams.set("senderId", dlt.senderId)
  url.searchParams.set("entityId", dlt.entityId)
  url.searchParams.set("templateId", dlt.templateId)
  url.searchParams.set("message", text)
  const { res, body } = await call(config, fetchImpl, url, "POST")
  if (!res.ok || body?.responseCode !== 200) {
    throw new Error(`Message Central did not send the SMS (HTTP ${res.status}, code ${body?.responseCode ?? "none"})`)
  }
}
