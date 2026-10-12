import { expect, test } from "@playwright/test"

// Guards for phone speed (measured with Lighthouse, mobile, slow 4G: see docs/QUALITY.md).
// Fails if fonts are preloaded again (that made phones fetch ~415 KB of fonts first),
// or if the JavaScript or fonts a first visit downloads grow past the budget.

const BUDGET_KB = { script: 180, font: 300 }

for (const path of ["/mr", "/mr/products/cotton-straight-kurta", "/en/store"]) {
  test(`speed budget: ${path}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "measured once")
    await page.goto(path, { waitUntil: "load" })
    await page.waitForLoadState("networkidle")
    expect(await page.locator('link[rel="preload"][as="font"]').count()).toBe(0)
    const kb = await page.evaluate(() => {
      const sum = (type: string) =>
        (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
          .filter((r) => r.initiatorType === type || (type === "font" && /\.woff2?$/.test(r.name)))
          .reduce((n, r) => n + r.encodedBodySize, 0) / 1024
      return { script: sum("script"), font: sum("font") }
    })
    console.log(path, Math.round(kb.script), "KB scripts,", Math.round(kb.font), "KB fonts")
    expect(kb.script).toBeLessThan(BUDGET_KB.script)
    expect(kb.font).toBeLessThan(BUDGET_KB.font)
  })
}
