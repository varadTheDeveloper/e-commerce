import { expect, test } from "@playwright/test"
import { newPhone } from "./helpers"

// Legal and help pages (placeholder details for now), consent and account deletion.

const PAGES = ["about", "contact", "shipping", "returns-policy", "privacy", "terms", "grievance", "faq"]

test("legal pages: all pages in every language, details filled in", async ({ page }) => {
  for (const locale of ["en", "hi", "mr"]) {
    for (const slug of PAGES) {
      const res = await page.goto(`/${locale}/${slug}`)
      expect(res?.status(), `${locale}/${slug}`).toBe(200)
      const article = page.getByTestId(`policy-${slug}`)
      await expect(article.locator("h1")).not.toBeEmpty()
      // Every {placeholder} was replaced
      expect(await article.innerText(), `${locale}/${slug}`).not.toMatch(/\{\w+\}/)
    }
  }
  await page.goto("/en/grievance")
  await expect(page.getByTestId("policy-draft")).toContainText("Draft for testing")
  await expect(page.getByTestId("policy-grievance")).toContainText("within 48 hours")
  await page.goto("/en/shipping")
  await expect(page.getByTestId("policy-shipping")).toContainText("₹999")
})

test("legal pages: linked from the footer and the product page", async ({ page }) => {
  await page.goto("/en")
  await page.locator("footer").getByRole("link", { name: "Privacy policy" }).click()
  await expect(page).toHaveURL(/\/en\/privacy$/)
  await expect(page.locator("h1")).toHaveText("Privacy policy")

  await page.goto("/mr/products/cotton-straight-kurta")
  await page.getByText("रिटर्न आणि बदल").first().click()
  await page.getByTestId("returns-policy-link").click()
  await expect(page).toHaveURL(/\/mr\/returns-policy$/)
  await expect(page.locator("h1")).toHaveText("रिटर्न आणि बदल धोरण")
})

test("account: delete my account, then the number starts a new account", async ({ page }) => {
  const phone = newPhone()
  const logIn = async () => {
    await page.goto("/en/account")
    await page.getByTestId("phone-input").fill(phone)
    await page.getByTestId("send-code-button").click()
    await page.getByTestId("code-input").fill("123456")
  }
  await logIn()
  await page.getByTestId("first-name-input").fill("Meera")
  await page.getByTestId("consent-checkbox").check()
  await page.getByTestId("create-account-button").click()
  await expect(page.getByTestId("account-hello")).toHaveText("Hello, Meera")

  await page.goto("/en/account/profile")
  await page.getByTestId("delete-account-start").click()
  await expect(page.getByTestId("delete-account-button")).toBeDisabled()
  await page.getByTestId("delete-account-confirm").check()
  await page.getByTestId("delete-account-button").click()
  await expect(page).toHaveURL(/\/en$/)

  // Logged out; the same number now signs up afresh
  await page.goto("/en/account")
  await expect(page.getByTestId("phone-input")).toBeVisible()
  await logIn()
  await expect(page.getByTestId("first-name-input")).toBeVisible()
})
