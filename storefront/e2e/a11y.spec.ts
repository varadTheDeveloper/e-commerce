import AxeBuilder from "@axe-core/playwright"
import { expect, Page, test } from "@playwright/test"
import { addAddress, addKurta, logIn } from "./helpers"

// Accessibility (WCAG 2.1 AA) checked with axe on the main pages, on desktop and phone.

async function check(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)
  expect(summary, `${name}\n${summary.join("\n")}`).toEqual([])
}

const PUBLIC = ["/mr", "/hi/store", "/en/products/cotton-straight-kurta", "/mr/search?q=kurta", "/mr/cart", "/mr/account", "/en/privacy", "/mr/faq"]

for (const path of PUBLIC) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    await check(page, path)
  })
}

test("a11y: bag, checkout and account pages when logged in", async ({ page }) => {
  await addKurta(page)
  await page.goto("/en/cart")
  await check(page, "bag")
  await page.goto("/en/checkout")
  await logIn(page)
  await addAddress(page)
  await check(page, "checkout")
  for (const path of ["/en/account", "/en/account/profile", "/en/account/addresses", "/en/account/orders"]) {
    await page.goto(path)
    await check(page, path)
  }
})

test("keyboard only: choose a size, log in at checkout and place a cash order", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard test on desktop")
  const press = async (testId: string, key = "Enter") => {
    await page.getByTestId(testId).focus()
    await page.keyboard.press(key)
  }
  await page.goto("/en/products/cotton-straight-kurta")
  await press("colour-maroon")
  await press("size-L")
  await press("add-product-button")
  await press("go-to-bag")
  await expect(page.getByTestId("bag-item")).toHaveCount(1)
  await press("checkout-button")

  await page.getByTestId("phone-input").focus()
  await page.keyboard.type(`7${String(Date.now()).slice(-9)}`)
  await page.keyboard.press("Enter")
  await page.getByTestId("code-input").focus()
  await page.keyboard.type("123456")
  await page.getByTestId("first-name-input").focus()
  await page.keyboard.type("Kiran")
  await press("consent-checkbox", "Space")
  await press("create-account-button")

  await press("add-address-button")
  const form = page.getByTestId("address-form")
  for (const [name, value] of [["pincode", "431203"], ["house", "Flat 4, Sai Residency"], ["area", "Ambad Road"], ["city", "Jalna"]]) {
    await form.locator(`input[name=${name}]`).focus()
    await page.keyboard.type(value)
  }
  await press("save-address-button")
  await expect(page.getByTestId("chosen-address")).toContainText("Ambad Road")
  await press("cod-option", "Space")
  await press("submit-order-button")
  await expect(page.getByTestId("order-placed")).toContainText("Thank you")
})
