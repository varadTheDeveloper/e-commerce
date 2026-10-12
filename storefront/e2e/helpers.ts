import { expect, Page } from "@playwright/test"

// Shared steps for the shop's browser tests.

let counter = 0
export function newPhone() {
  counter++
  return `8${String(Date.now() + counter * 7919).slice(-9)}`
}

export async function addKurta(page: Page, quantity = 1) {
  await page.goto("/en/products/cotton-straight-kurta")
  await page.getByTestId("colour-maroon").click()
  await page.getByTestId("size-L").click()
  await page.getByTestId("add-product-button").click()
  await expect(page.getByTestId("go-to-bag")).toBeVisible()
  if (quantity > 1) {
    await page.goto("/en/cart")
    for (let q = 2; q <= quantity; q++) {
      await page.getByTestId("bag-item-increase").click()
      await expect(page.getByTestId("bag-item-qty")).toHaveText(String(q))
    }
  }
}

export async function logIn(page: Page, name = "Asha") {
  await page.getByTestId("phone-input").fill(newPhone())
  await page.getByTestId("send-code-button").click()
  await page.getByTestId("code-input").fill("123456")
  await page.getByTestId("first-name-input").fill(name)
  await page.getByTestId("consent-checkbox").check()
  await page.getByTestId("create-account-button").click()
}

export async function addAddress(page: Page, pincode = "431203") {
  await page.getByTestId("add-address-button").click()
  const form = page.getByTestId("address-form")
  await form.locator("input[name=pincode]").fill(pincode)
  await form.locator("input[name=house]").fill("Flat 4, Sai Residency")
  await form.locator("input[name=area]").fill("Ambad Road")
  await form.locator("input[name=city]").fill("Jalna")
  await page.getByTestId("save-address-button").click()
  await expect(page.getByTestId("chosen-address")).toContainText("Ambad Road")
}

export const submit = (page: Page, phone: boolean) => page.getByTestId(phone ? "submit-order-button-mobile" : "submit-order-button")

// Needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (an admin user) and the backend started with
// the fake Shiprocket and SHIPROCKET_WEBHOOK_TOKEN=E2E_WEBHOOK_TOKEN (CI sets these).
export const BACKEND = process.env.E2E_BACKEND_URL || "http://localhost:9000"
export const ADMIN = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD }
export const HOOK_TOKEN = process.env.E2E_WEBHOOK_TOKEN
export const canShip = !!(ADMIN.email && ADMIN.password && HOOK_TOKEN)

/** Headers for the admin API (staff login). */
export async function adminHeaders(page: Page) {
  const login = await page.request.post(`${BACKEND}/auth/user/emailpass`, { data: ADMIN })
  return { authorization: `Bearer ${(await login.json()).token}` }
}

/** Staff create the fulfillment (books the courier); returns the tracking number. */
export async function shipOrder(page: Page, orderId: string, admin: Record<string, string>) {
  await expect
    .poll(async () => (await (await page.request.get(`${BACKEND}/admin/orders/${orderId}?fields=metadata`, { headers: admin })).json()).order.metadata?.payment_method)
    .toBeTruthy()
  const { order } = await (await page.request.get(`${BACKEND}/admin/orders/${orderId}?fields=items.*`, { headers: admin })).json()
  const fulfil = await page.request.post(`${BACKEND}/admin/orders/${orderId}/fulfillments`, {
    headers: admin,
    data: { items: order.items.map((i: { id: string; quantity: number }) => ({ id: i.id, quantity: i.quantity })) },
  })
  expect(fulfil.status()).toBe(200)
  const after = await (await page.request.get(`${BACKEND}/admin/orders/${orderId}?fields=fulfillments.*`, { headers: admin })).json()
  return after.order.fulfillments[0].data.awb as string
}

/** The courier reports a status for a parcel. */
export async function courierUpdate(page: Page, awb: string, status: string) {
  const hook = await page.request.post(`${BACKEND}/hooks/delivery-updates`, {
    headers: { "x-api-key": HOOK_TOKEN! },
    data: { awb, current_status: status },
  })
  expect(hook.status()).toBe(200)
}
