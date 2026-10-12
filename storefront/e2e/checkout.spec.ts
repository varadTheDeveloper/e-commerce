import { expect, Page, test } from "@playwright/test"

// Needs the backend in test mode (SMS_PROVIDER=console, OTP_TEST_CODE=123456) and,
// for the online payment test, the fake Razorpay API:
//   node backend/integration-tests/fake-razorpay.js
// with the backend started with RAZORPAY_KEY_ID=rzp_test_fake RAZORPAY_KEY_SECRET=fake-secret
// RAZORPAY_API_BASE=http://127.0.0.1:9911. Razorpay's own payment window is replaced by a
// stand-in that "pays" through the fake API, like a shopper would.

const FAKE_RAZORPAY = process.env.FAKE_RAZORPAY_URL || "http://127.0.0.1:9911"
const SHOTS = process.env.E2E_SCREENSHOTS

let counter = 0
function newPhone() {
  counter++
  return `8${String(Date.now() + counter * 7919).slice(-9)}`
}

async function addKurta(page: Page, quantity = 1) {
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

async function logIn(page: Page, name = "Asha") {
  await page.getByTestId("phone-input").fill(newPhone())
  await page.getByTestId("send-code-button").click()
  await page.getByTestId("code-input").fill("123456")
  await page.getByTestId("first-name-input").fill(name)
  await page.getByTestId("create-account-button").click()
}

async function addAddress(page: Page, pincode = "431203") {
  await page.getByTestId("add-address-button").click()
  const form = page.getByTestId("address-form")
  await form.locator("input[name=pincode]").fill(pincode)
  await form.locator("input[name=house]").fill("Flat 4, Sai Residency")
  await form.locator("input[name=area]").fill("Ambad Road")
  await form.locator("input[name=city]").fill("Jalna")
  await page.getByTestId("save-address-button").click()
  await expect(page.getByTestId("chosen-address")).toContainText("Ambad Road")
}

const submit = (page: Page, phone: boolean) => page.getByTestId(phone ? "submit-order-button-mobile" : "submit-order-button")

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
// Needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (an admin user) and the backend started with
// the fake Shiprocket and SHIPROCKET_WEBHOOK_TOKEN=E2E_WEBHOOK_TOKEN (CI sets these).
const BACKEND = process.env.E2E_BACKEND_URL || "http://localhost:9000"
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD }
const HOOK_TOKEN = process.env.E2E_WEBHOOK_TOKEN

test("orders: shipped by staff, tracked by the customer", async ({ page }, info) => {
  test.skip(!ADMIN.email || !ADMIN.password || !HOOK_TOKEN, "needs an admin user and the webhook token")
  await addKurta(page)
  await page.goto("/en/checkout")
  await logIn(page)
  await addAddress(page)
  await page.getByTestId("cod-option").check()
  await submit(page, info.project.name === "phone").click()
  await expect(page.getByTestId("order-placed")).toBeVisible()
  const orderId = page.url().match(/order\/(order_[A-Za-z0-9]+)/)![1]

  // Staff: "Create fulfillment" in the admin (books the courier)
  const login = await page.request.post(`${BACKEND}/auth/user/emailpass`, { data: ADMIN })
  const admin = { authorization: `Bearer ${(await login.json()).token}` }
  await expect
    .poll(async () => (await (await page.request.get(`${BACKEND}/admin/orders/${orderId}?fields=metadata`, { headers: admin })).json()).order.metadata?.payment_method)
    .toBe("cod")
  const { order } = await (await page.request.get(`${BACKEND}/admin/orders/${orderId}?fields=items.*`, { headers: admin })).json()
  const fulfil = await page.request.post(`${BACKEND}/admin/orders/${orderId}/fulfillments`, {
    headers: admin,
    data: { items: order.items.map((i: { id: string; quantity: number }) => ({ id: i.id, quantity: i.quantity })) },
  })
  expect(fulfil.status()).toBe(200)
  const after = await (await page.request.get(`${BACKEND}/admin/orders/${orderId}?fields=fulfillments.*`, { headers: admin })).json()
  const awb = after.order.fulfillments[0].data.awb

  // Courier: picked up
  const hook = await page.request.post(`${BACKEND}/hooks/delivery-updates`, {
    headers: { "x-api-key": HOOK_TOKEN! },
    data: { awb, current_status: "IN TRANSIT" },
  })
  expect(hook.status()).toBe(200)

  await page.goto(`/en/account/orders/details/${orderId}`)
  await expect(page.getByTestId("track-shipped")).toHaveAttribute("data-done", "true")
  await expect(page.getByTestId("order-tracking")).toContainText(`Tracking number: ${awb}`)
  await expect(page.getByTestId("track-link")).toHaveAttribute("href", `https://shiprocket.co/tracking/${awb}`)
  // Shipped: too late to cancel
  await expect(page.getByTestId("cancel-order-button")).toHaveCount(0)
})
