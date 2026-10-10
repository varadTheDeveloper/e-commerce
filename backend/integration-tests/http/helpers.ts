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
  await api.post("/store/otp/account", { first_name: firstName }, { headers: { ...headers, authorization: `Bearer ${data.token}` } })
  const refreshed = await api.post("/auth/token/refresh", {}, { headers: { authorization: `Bearer ${data.token}` } })
  return { ...headers, authorization: `Bearer ${refreshed.data.token}` }
}
