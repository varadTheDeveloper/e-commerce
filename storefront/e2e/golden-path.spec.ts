import { expect, test } from "@playwright/test"
import { addAddress, adminHeaders, BACKEND, canShip, courierUpdate, logIn, shipOrder } from "./helpers"

// The whole journey once, as a shopper and staff would do it: search, product, bag,
// log in at checkout, pay online, staff ship it, delivered, return, refunded.
// Needs the fake Razorpay and Shiprocket, an admin user and the webhook token (see helpers.ts).

const FAKE_RAZORPAY = process.env.FAKE_RAZORPAY_URL || "http://127.0.0.1:9911"

test("golden path: search → buy online → delivered → return → refunded", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one full run is enough")
  test.skip(!canShip, "needs an admin user and the webhook token")
  test.setTimeout(120_000)
  // Razorpay's payment window replaced by a stand-in that pays through the fake API
  await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
        window.Razorpay = function (options) { this.options = options };
        window.Razorpay.prototype.on = function () {};
        window.Razorpay.prototype.open = function () {
          var o = this.options;
          fetch(${JSON.stringify(FAKE_RAZORPAY)} + "/test/pay/" + o.order_id, { method: "POST" }).then(function () {
            o.handler({ razorpay_payment_id: "pay_x", razorpay_order_id: o.order_id, razorpay_signature: "x" });
          });
        };`,
    })
  )

  // Search and pick a product
  await page.goto("/en")
  await page.getByTestId("nav-search-link").click()
  await page.getByTestId("search-input").fill("kurta")
  await page.getByTestId("search-input").press("Enter")
  await expect(page).toHaveURL(/\/en\/search\?q=kurta/)
  await page.getByTestId("product-card").filter({ hasText: "Cotton Straight Kurta" }).first().click()
  await expect(page.getByTestId("pdp-title")).toHaveText("Cotton Straight Kurta")
  await page.getByTestId("colour-maroon").click()
  await page.getByTestId("size-L").click()
  await page.getByTestId("add-product-button").click()
  await page.getByTestId("go-to-bag").click()
  await expect(page.getByTestId("bag-item")).toHaveCount(1)

  // Checkout: log in, address, pay online
  await page.getByTestId("checkout-button").click()
  await logIn(page, "Sneha")
  await addAddress(page)
  await expect(page.getByTestId("checkout-total")).toHaveText("₹978")
  await page.getByTestId("submit-order-button").click()
  await expect(page.getByTestId("order-placed")).toContainText("Thank you")
  await expect(page.getByTestId("order-payment")).toContainText("Paid online")
  const orderId = page.url().match(/order\/(order_[A-Za-z0-9]+)/)![1]

  // Staff ship it; the courier delivers
  const admin = await adminHeaders(page)
  const awb = await shipOrder(page, orderId, admin)
  await courierUpdate(page, awb, "IN TRANSIT")
  await courierUpdate(page, awb, "DELIVERED")
  await page.goto(`/en/account/orders/details/${orderId}`)
  await expect(page.getByTestId("track-delivered")).toHaveAttribute("data-done", "true")

  // Return it: paid online, so no bank details are asked
  await page.getByTestId("start-return").click()
  await page.getByTestId("return-item-check").check()
  await page.getByTestId("return-reason").selectOption("too_large")
  await expect(page.getByTestId("refund-upi")).toHaveCount(0)
  await page.getByTestId("submit-return").click()
  await expect(page.getByTestId("return-sent")).toBeVisible()

  // Staff approve, the parcel comes back, staff mark it received: refunded through Razorpay
  const { return_requests } = await (await page.request.get(`${BACKEND}/admin/return-requests?status=requested`, { headers: admin })).json()
  const request = return_requests.find((r: { order_id: string }) => r.order_id === orderId)
  expect((await page.request.post(`${BACKEND}/admin/return-requests/${request.id}/approve`, { headers: admin })).status()).toBe(200)
  expect((await page.request.post(`${BACKEND}/admin/return-requests/${request.id}/receive`, { headers: admin })).status()).toBe(200)
  await page.goto(`/en/account/orders/details/${orderId}`)
  await expect(page.getByTestId("return-request")).toHaveAttribute("data-status", "refunded")
  await expect(page.getByTestId("return-request")).toContainText("Refund: ₹899")
})
