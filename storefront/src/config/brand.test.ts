import { readFileSync } from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import { BRAND } from "./brand"
import { SELLER } from "./seller"

const backend = (file: string) => readFileSync(path.resolve(__dirname, "../../../backend/src/config", file), "utf8")
const value = (src: string, key: string) => src.match(new RegExp(`${key}:\\s*"?([^",\\n]+)`))?.[1]

describe("brand settings", () => {
  it("shows the same free-delivery amount the backend charges by", () => {
    const shop = readFileSync(path.resolve(__dirname, "../../../backend/src/config/shop.ts"), "utf8")
    const from = Number(shop.match(/freeShippingFrom:\s*(\d+)/)?.[1])
    expect(from).toBeGreaterThan(0)
    expect(BRAND.freeDeliveryFrom).toBe(from)
  })

  it("shows the backend's delivery charge, COD limit and return days", () => {
    const shop = backend("shop.ts")
    expect(BRAND.shippingFee).toBe(Number(value(shop, "shippingFee")))
    expect(BRAND.codMaxOrder).toBe(Number(value(shop, "codMaxOrder")))
    expect(BRAND.returnDays).toBe(Number(value(shop, "returnWindowDays")))
  })

  it("shows the same seller name, GSTIN and email as the invoices", () => {
    const seller = backend("seller.ts")
    expect(SELLER.legalName).toBe(value(seller, "legalName"))
    expect(SELLER.gstin).toBe(value(seller, "gstin"))
    expect(SELLER.email).toBe(value(seller, "email"))
  })
})
