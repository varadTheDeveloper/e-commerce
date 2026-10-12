import { expect, Page, test } from "@playwright/test"
import { addAddress, addKurta, adminHeaders, BACKEND, canShip, courierUpdate, logIn, shipOrder, submit } from "./helpers"

// Returns and size exchanges after delivery. Needs an admin user and the webhook token (see helpers.ts).

// A 1×1 PNG, as a phone photo stand-in
const SHOTS = process.env.E2E_SCREENSHOTS
const PHOTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")

/** A cash-on-delivery order for one kurta (maroon, L), delivered by the courier. */
async function deliveredOrder(page: Page, phone: boolean) {
  await addKurta(page)
  await page.goto("/en/checkout")
  await logIn(page)
  await addAddress(page)
  await page.getByTestId("cod-option").check()
  await submit(page, phone).click()
  await expect(page.getByTestId("order-placed")).toBeVisible()
  const orderId = page.url().match(/order\/(order_[A-Za-z0-9]+)/)![1]
  const admin = await adminHeaders(page)
  const awb = await shipOrder(page, orderId, admin)
  await courierUpdate(page, awb, "DELIVERED")
  return { orderId, admin }
}

test("returns: return a cash-on-delivery order, refund to UPI", async ({ page }, info) => {
  test.skip(!canShip, "needs an admin user and the webhook token")
  const { orderId, admin } = await deliveredOrder(page, info.project.name === "phone")

  await page.goto(`/en/account/orders/details/${orderId}`)
  await expect(page.getByTestId("order-returns")).toContainText("You can return or exchange items until")
  await page.getByTestId("start-return").click()
  await expect(page.getByTestId("return-form")).toBeVisible()

  // Nothing chosen yet
  await page.getByTestId("submit-return").click()
  await expect(page.getByTestId("return-error")).toHaveText("Choose at least one item.")

  await page.getByTestId("return-item-check").check()
  await page.getByTestId("return-reason").selectOption("changed_mind")
  // Paid in cash: the refund needs a UPI ID or bank account
  await page.getByTestId("refund-upi").fill("asha")
  await page.getByTestId("submit-return").click()
  await expect(page.getByTestId("return-error")).toHaveText("Enter a valid UPI ID or bank account (with IFSC).")
  await page.getByTestId("refund-upi").fill("asha@okaxis")
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/return-form-${info.project.name}.png`, fullPage: true })
  await page.getByTestId("submit-return").click()

  await expect(page.getByTestId("return-sent")).toBeVisible()
  const request = page.getByTestId("return-request")
  await expect(request).toHaveAttribute("data-status", "requested")
  await expect(request).toContainText("Return of 1 item(s)")
  await expect(request).toContainText("Refund: ₹899")
  // The only item is in the request now
  await expect(page.getByTestId("start-return")).toHaveCount(0)

  // Staff approve: a courier pickup is booked
  const { return_requests } = await (await page.request.get(`${BACKEND}/admin/return-requests?status=requested`, { headers: admin })).json()
  const mine = return_requests.find((r: { order_id: string }) => r.order_id === orderId)
  expect(mine.refund_to).toBe("UPI as••••@okaxis")
  expect((await page.request.post(`${BACKEND}/admin/return-requests/${mine.id}/approve`, { headers: admin })).status()).toBe(200)

  await page.goto(`/en/account/orders/details/${orderId}`)
  await expect(request).toHaveAttribute("data-status", "approved")
  await expect(request.getByRole("link", { name: "Track pickup" })).toBeVisible()
  if (SHOTS) await page.getByTestId("order-returns").screenshot({ path: `${SHOTS}/order-returns-${info.project.name}.png` })
})

test("returns: exchange for another size, photo for a damaged item", async ({ page }, info) => {
  test.skip(!canShip, "needs an admin user and the webhook token")
  const { orderId } = await deliveredOrder(page, info.project.name === "phone")

  await page.goto(`/en/account/orders/details/${orderId}/return`)
  await page.getByTestId("type-exchange").check()
  await page.getByTestId("return-item-check").check()
  await page.getByTestId("return-reason").selectOption("damaged")
  // L was ordered: the other sizes of the same colour are offered
  const size = page.getByTestId("return-size")
  await expect(size.locator("option")).toHaveText(["—", "S", "M", "XL", "XXL"])
  await size.selectOption({ label: "M" })
  // No refund account for an exchange
  await expect(page.getByTestId("refund-upi")).toHaveCount(0)

  // Damaged: a photo is needed
  await page.getByTestId("submit-return").click()
  await expect(page.getByTestId("return-error")).toHaveText("Add a photo of the damaged or wrong item.")
  await page.getByTestId("photo-input").setInputFiles({ name: "kurta.png", mimeType: "image/png", buffer: PHOTO })
  await expect(page.getByTestId("return-form").locator("img[alt='']").last()).toHaveAttribute("src", /returns\//)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/exchange-form-${info.project.name}.png`, fullPage: true })
  await page.getByTestId("submit-return").click()

  await expect(page.getByTestId("return-sent")).toBeVisible()
  await expect(page.getByTestId("return-request")).toContainText("Exchange of 1 item(s)")
  await expect(page.getByTestId("return-request")).toContainText("Waiting for approval")
})
