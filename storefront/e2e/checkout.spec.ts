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

async function addAddress(page: Page) {
  await page.getByTestId("add-address-button").click()
  const form = page.getByTestId("address-form")
  await form.locator("input[name=pincode]").fill("431203")
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

  // The bag is empty after the order
  await page.goto("/en/cart")
  await expect(page.getByTestId("empty-cart-message")).toBeVisible()
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
