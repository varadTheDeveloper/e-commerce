import { readFileSync } from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import { BRAND } from "./brand"

describe("brand settings", () => {
  it("shows the same free-delivery amount the backend charges by", () => {
    const shop = readFileSync(path.resolve(__dirname, "../../../backend/src/config/shop.ts"), "utf8")
    const from = Number(shop.match(/freeShippingFrom:\s*(\d+)/)?.[1])
    expect(from).toBeGreaterThan(0)
    expect(BRAND.freeDeliveryFrom).toBe(from)
  })
})
