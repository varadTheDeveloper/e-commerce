import { expect, test } from "@playwright/test"

// Uses the demo catalogue from `yarn seed` in backend/.

test.describe("languages", () => {
  test("sends visitors to their browser language, Marathi by default", async ({ browser }) => {
    const hindi = await browser.newContext({ locale: "hi-IN" })
    const page = await hindi.newPage()
    await page.goto("/")
    await expect(page).toHaveURL(/\/hi$/)
    await hindi.close()

    const other = await browser.newContext({ locale: "fr-FR" })
    const page2 = await other.newPage()
    await page2.goto("/store")
    await expect(page2).toHaveURL(/\/mr\/store$/)
    await expect(page2.locator("html")).toHaveAttribute("lang", "mr")
    await other.close()
  })

  test("shows product text in the chosen language", async ({ page }) => {
    await page.goto("/mr/products/cotton-straight-kurta")
    await expect(page.getByTestId("pdp-title")).toHaveText("कॉटन स्ट्रेट कुर्ता")
    await page.goto("/hi/products/slim-fit-oxford-shirt")
    await expect(page.getByTestId("pdp-title")).toHaveText("स्लिम फिट ऑक्सफ़र्ड शर्ट")
    await page.goto("/en/products/slim-fit-oxford-shirt")
    await expect(page.getByTestId("pdp-title")).toHaveText("Slim Fit Oxford Shirt")
  })
})

test("listing: filter by size and sort by price", async ({ page, isMobile }) => {
  await page.goto("/en/categories/men")
  await expect(page.getByTestId("listing-title")).toContainText("Men")
  const cards = page.getByTestId("product-card")
  const before = await cards.count()
  expect(before).toBeGreaterThan(1)

  // Waist sizes only exist on jeans
  if (isMobile) {
    await page.getByTestId("open-filters").click()
    await page.getByTestId("filter-size-30").filter({ visible: true }).click()
    await expect(page).toHaveURL(/size=30/)
    await page.getByTestId("apply-filters").click()
  } else {
    await page.getByTestId("filter-size-30").filter({ visible: true }).click()
    await expect(page).toHaveURL(/size=30/)
  }
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText("Jeans")

  if (!isMobile) {
    await page.goto("/en/categories/men?sort=price-asc")
    const amounts = (
      await page.getByTestId("product-card").getByTestId("product-price").evaluateAll((els) =>
        els.map((el) => Number(el.getAttribute("data-amount")))
      )
    )
    expect(amounts.length).toBeGreaterThan(1)
    expect([...amounts].sort((a, b) => a - b)).toEqual(amounts)
  }
})

test("product: pick colour and size, add to bag", async ({ page }) => {
  await page.goto("/en/products/classic-crew-t-shirt")
  await expect(page.getByTestId("product-price").first()).toHaveAttribute("data-amount", "499")

  // Adding without a size asks for one
  await page.getByTestId("add-product-button").click()
  await expect(page.getByText("Please select a size")).toBeVisible()

  // Black XXL is sold out in the demo data
  await page.getByTestId("colour-black").click()
  await expect(page.getByTestId("size-XXL")).toBeDisabled()

  // White S has only 3 left
  await page.getByTestId("colour-white").click()
  await page.getByTestId("size-S").click()
  await expect(page.getByTestId("low-stock")).toHaveText("Only 3 left")

  await page.getByTestId("size-M").click()
  await page.getByTestId("add-product-button").click()
  await expect(page.getByTestId("go-to-bag")).toBeVisible()
  await page.getByTestId("go-to-bag").click()
  await expect(page).toHaveURL(/\/en\/cart/)
})

test("product: size chart and pincode", async ({ page }) => {
  await page.goto("/en/products/slim-fit-stretch-jeans")
  await page.getByTestId("size-chart-button").click()
  await expect(page.getByTestId("size-chart-table")).toContainText("Waist")
  await page.keyboard.press("Escape")

  await page.getByTestId("pincode-input").fill("12345")
  await page.getByRole("button", { name: "Check" }).click()
  await expect(page.getByTestId("pincode-result")).toContainText("valid 6-digit")
  // Answers come from the courier check (the fake Shiprocket in tests: 9… not served, 8… no COD)
  await page.getByTestId("pincode-input").fill("431203")
  await page.getByRole("button", { name: "Check" }).click()
  await expect(page.getByTestId("pincode-result")).toContainText("Delivery by")
  await expect(page.getByTestId("pincode-result")).toContainText("Cash on delivery available")
  await page.getByTestId("pincode-input").fill("800001")
  await page.getByRole("button", { name: "Check" }).click()
  await expect(page.getByTestId("pincode-result")).toContainText("not available here")
  await page.getByTestId("pincode-input").fill("900001")
  await page.getByRole("button", { name: "Check" }).click()
  await expect(page.getByTestId("pincode-result")).toContainText("do not deliver")
})

test("wishlist: save from a product card and see it on the wishlist page", async ({ page }) => {
  await page.goto("/en/categories/men-jeans")
  await page.getByTestId("product-card").first().getByTestId("wishlist-toggle").click()
  await page.goto("/en/wishlist")
  await expect(page.getByTestId("wishlist-items").getByTestId("product-card")).toHaveCount(1)
  await expect(page.getByTestId("wishlist-items")).toContainText("Jeans")
})

test("search finds English words on the Marathi site", async ({ page }) => {
  await page.goto("/mr/search?q=kurta")
  await expect(page.getByTestId("product-card").first()).toContainText("कुर्ता")
  await page.goto("/mr/search?q=jeens")
  await expect(page.getByTestId("product-card")).toHaveCount(1)
})
