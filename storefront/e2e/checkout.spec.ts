import { expect, test } from "@playwright/test"
import { addAddress, addKurta, adminHeaders, canShip, courierUpdate, logIn, shipOrder, submit } from "./helpers"

// Needs the backend in test mode (SMS_PROVIDER=console, OTP_TEST_CODE=123456) and,
// for the online payment test, the fake Razorpay API:
//   node backend/integration-tests/fake-razorpay.js
// with the backend started with RAZORPAY_KEY_ID=rzp_test_fake RAZORPAY_KEY_SECRET=fake-secret
// RAZORPAY_API_BASE=http://127.0.0.1:9911. Razorpay's own payment window is replaced by a
// stand-in that "pays" through the fake API, like a shopper would.

const FAKE_RAZORPAY = process.env.FAKE_RAZORPAY_URL || "http://127.0.0.1:9911"
const SHOTS = process.env.E2E_SCREENSHOTS

test("checkout: log in at checkout, add an address, pay cash on delivery", async ({ page }, info) => {
  await addKurta(page)
  await page.goto("/en/checkout")
  await expect(page.getByTestId("checkout-login")).toBeVisible()
  await logIn(page)
  await addAddress(page)

  await expect(page.getByTestId("checkout-delivery-date")).toContainText("Delivery by")
  // Below ₹999: delivery is charged
  await expect(page.getByTestId("checkout-delivery")).toHaveText("₹79")
  await expect(page.getByTestId("checkout-total")).toHaveText("₹978")
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/checkout-${info.project.name}.png`, fullPage: true })

  await page.getByTestId("cod-option").check()
  // Logged in by SMS a moment ago: no second code needed
  await submit(page, info.project.name === "phone").click()

  await expect(page.getByTestId("order-placed")).toContainText("Thank you")
  await expect(page.getByTestId("order-total")).toHaveText("₹978")
  await expect(page.getByTestId("order-payment")).toContainText("Cash on delivery")
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/order-placed-${info.project.name}.png`, fullPage: true })

  // GST invoice for this customer
  const href = await page.getByTestId("invoice-link").getAttribute("href")
  const pdf = await page.request.get(href!)
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()["content-type"]).toBe("application/pdf")

  // Delivery steps: ordered, not yet packed
  await expect(page.getByTestId("track-placed")).toHaveAttribute("data-done", "true")
  await expect(page.getByTestId("track-packed")).toHaveAttribute("data-done", "false")

  // The bag is empty after the order
  await page.goto("/en/cart")
  await expect(page.getByTestId("empty-cart-message")).toBeVisible()
})

test("orders: cancel before it is shipped", async ({ page }, info) => {
  await addKurta(page)
  await page.goto("/en/checkout")
  await logIn(page)
  await addAddress(page)
  await page.getByTestId("cod-option").check()
  await submit(page, info.project.name === "phone").click()
  await expect(page.getByTestId("order-placed")).toBeVisible()

  await page.getByTestId("cancel-order-button").click()
  await expect(page.getByTestId("confirm-cancel-button")).toBeDisabled()
  await page.getByLabel("I ordered by mistake").check()
  await page.getByTestId("confirm-cancel-button").click()
  await expect(page.getByTestId("order-canceled")).toContainText("Cancelled on")
  await expect(page.getByTestId("cancel-order-button")).toHaveCount(0)
})

test("checkout: no cash on delivery where couriers cannot collect it", async ({ page }) => {
  await addKurta(page)
  await page.goto("/en/checkout")
  await logIn(page)
  await addAddress(page, "800001")
  await expect(page.getByTestId("cod-option")).toBeDisabled()
  await expect(page.getByTestId("checkout-payment")).toContainText("not available here")
})

test("checkout: pay online (Razorpay), free delivery from ₹999", async ({ page }, info) => {
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

  await page.goto("/en/account")
  await logIn(page, "Ravi")
  await expect(page.getByTestId("account-hello")).toBeVisible()
  await addKurta(page, 2)
  await page.goto("/en/checkout")
  await addAddress(page)

  await expect(page.getByTestId("checkout-delivery")).toHaveText("Free")
  await expect(page.getByTestId("checkout-total")).toHaveText("₹1,798")
  await submit(page, info.project.name === "phone").click()

  await expect(page.getByTestId("order-placed")).toContainText("Thank you")
  await expect(page.getByTestId("order-total")).toHaveText("₹1,798")
  await expect(page.getByTestId("order-payment")).toContainText("Paid online")

  // Listed under My orders, with the same details
  await page.goto("/en/account/orders")
  await page.getByTestId("order-row").first().getByRole("link").click()
  await expect(page.getByTestId("order-total")).toHaveText("₹1,798")
})

test("checkout: Marathi texts", async ({ page }) => {
  await addKurta(page)
  await page.goto("/mr/checkout")
  await expect(page.getByTestId("back-to-cart-link")).toContainText("बॅगकडे परत जा")
  await expect(page.getByTestId("checkout-login")).toContainText("ऑर्डर करण्यासाठी लॉग इन करा")
})

// Staff ship the order in the admin, the courier sends an update, the customer sees it.
// Needs an admin user and the webhook token (see helpers.ts).
test("orders: shipped by staff, tracked by the customer", async ({ page }, info) => {
  test.skip(!canShip, "needs an admin user and the webhook token")
  await addKurta(page)
  await page.goto("/en/checkout")
  await logIn(page)
  await addAddress(page)
  await page.getByTestId("cod-option").check()
  await submit(page, info.project.name === "phone").click()
  await expect(page.getByTestId("order-placed")).toBeVisible()
  const orderId = page.url().match(/order\/(order_[A-Za-z0-9]+)/)![1]

  // Staff: "Create fulfillment" in the admin (books the courier)
  const awb = await shipOrder(page, orderId, await adminHeaders(page))
  // Courier: picked up
  await courierUpdate(page, awb, "IN TRANSIT")

  await page.goto(`/en/account/orders/details/${orderId}`)
  await expect(page.getByTestId("track-shipped")).toHaveAttribute("data-done", "true")
  await expect(page.getByTestId("order-tracking")).toContainText(`Tracking number: ${awb}`)
  await expect(page.getByTestId("track-link")).toHaveAttribute("href", `https://shiprocket.co/tracking/${awb}`)
  // Shipped: too late to cancel
  await expect(page.getByTestId("cancel-order-button")).toHaveCount(0)
})
