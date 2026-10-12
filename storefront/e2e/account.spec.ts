import { expect, Page, test } from "@playwright/test"

// Needs the backend started with SMS_PROVIDER=console and OTP_TEST_CODE=123456
// (test mode: every login code is 123456; refused in production).

let counter = 0
/** A fresh mobile number per test, so every run signs up a new customer. */
function newPhone() {
  counter++
  return `9${String(Date.now() + counter * 7919).slice(-9)}`
}

async function signUp(page: Page, name = "Asha") {
  await page.goto("/en/account")
  await page.getByTestId("phone-input").fill(newPhone())
  await page.getByTestId("send-code-button").click()
  await page.getByTestId("code-input").fill("123456")
  await page.getByTestId("first-name-input").fill(name)
  await page.getByTestId("consent-checkbox").check()
  await page.getByTestId("create-account-button").click()
  await expect(page.getByTestId("account-hello")).toHaveText(`Hello, ${name}`)
}

test("login: wrong code is refused, right code signs up, logout works", async ({ page }) => {
  await page.goto("/en/account")
  await page.getByTestId("phone-input").fill("12345")
  await page.getByTestId("send-code-button").click()
  await expect(page.getByTestId("login-error")).toContainText("valid 10-digit")

  await page.getByTestId("phone-input").fill(newPhone())
  await page.getByTestId("send-code-button").click()
  await page.getByTestId("code-input").fill("000000")
  await expect(page.getByTestId("login-error")).toContainText("wrong or has expired")

  await page.getByTestId("code-input").fill("123456")
  await page.getByTestId("first-name-input").fill("Ravi")
  // Must agree to the privacy policy and terms first
  await page.getByTestId("create-account-button").click()
  await expect(page.getByTestId("login-error")).toContainText("tick the box")
  await expect(page.getByTestId("login-page").getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/en/privacy")
  await page.getByTestId("consent-checkbox").check()
  await page.getByTestId("create-account-button").click()
  await expect(page.getByTestId("account-hello")).toHaveText("Hello, Ravi")

  await page.getByTestId("logout-button").click()
  await expect(page.getByTestId("phone-input")).toBeVisible()
})

test("addresses: add an Indian address and see it listed", async ({ page }) => {
  await signUp(page)
  await page.goto("/en/account/addresses")
  await page.getByTestId("add-address-button").click()
  const form = page.getByTestId("address-form")
  await form.locator("input[name=pincode]").fill("4312")
  await form.locator("input[name=house]").fill("Flat 4, Sai Residency")
  await form.locator("input[name=area]").fill("Ambad Road")
  await form.locator("input[name=city]").fill("Jalna")
  await page.getByTestId("save-address-button").click()
  await expect(form).toContainText("valid 6-digit pincode")

  await form.locator("input[name=pincode]").fill("431203")
  await page.getByTestId("save-address-button").click()
  const card = page.getByTestId("address-card")
  await expect(card).toContainText("Ambad Road")
  await expect(card).toContainText("Maharashtra 431203")
  await expect(card).toContainText("Default")
})

test("bag: change quantity, totals follow, remove empties the bag", async ({ page }) => {
  await page.goto("/en/products/cotton-straight-kurta")
  await page.getByTestId("colour-maroon").click()
  await page.getByTestId("size-L").click()
  await page.getByTestId("add-product-button").click()
  await page.getByTestId("go-to-bag").click()

  await expect(page.getByTestId("bag-item")).toHaveCount(1)
  await expect(page.getByTestId("bag-total")).toHaveText("₹899")
  await page.getByTestId("bag-item-increase").click()
  await expect(page.getByTestId("bag-item-qty")).toHaveText("2")
  await expect(page.getByTestId("bag-total")).toHaveText("₹1,798")
  await expect(page.getByTestId("bag-summary")).toContainText("₹2,998") // MRP 2 × 1,499

  await page.getByTestId("bag-item-remove").click()
  await expect(page.getByTestId("empty-cart-message")).toBeVisible()
})

test("wishlist: hearts saved before login move into the account", async ({ page }) => {
  await page.goto("/en/categories/men-jeans")
  await page.getByTestId("product-card").first().getByTestId("wishlist-toggle").click()
  await signUp(page, "Meera")
  await page.goto("/en/wishlist")
  await expect(page.getByTestId("wishlist-items")).toContainText("Jeans")

  // Saved in the account: a fresh browser with only the login cookie still sees it
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await expect(page.getByTestId("wishlist-items")).toContainText("Jeans")
})
