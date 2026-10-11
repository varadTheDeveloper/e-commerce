import { readFileSync } from "fs"
import path from "path"
import { clothingRate, financialYear, GST_STATE_CODES, gstSummary } from "../gst"

describe("GST on clothing", () => {
  it("is 5% up to ₹2,500 per piece before tax, 18% above", () => {
    expect(clothingRate(499)).toBe(5)
    expect(clothingRate(2625)).toBe(5) // 2625 / 1.05 = 2500
    expect(clothingRate(2626)).toBe(18)
    expect(clothingRate(4999)).toBe(18)
  })

  it("judges each piece, not the line", () => {
    const s = gstSummary([{ description: "Kurta", hsn: "6211", quantity: 3, total: 3 * 2000 }], 0, "27", "27")
    expect(s.lines[0].rate).toBe(5)
  })

  it("splits CGST + SGST in the seller's state and adds up to what was paid", () => {
    const s = gstSummary(
      [
        { description: "T-shirt", hsn: "6109", quantity: 2, total: 1198 },
        { description: "Jacket", hsn: "6201", quantity: 1, total: 3499 },
      ],
      79,
      "27",
      "27"
    )
    expect(s.intraState).toBe(true)
    expect(s.igst).toBe(0)
    expect(s.lines[0]).toMatchObject({ rate: 5, taxable: 1140.95, cgst: 28.53, sgst: 28.52 })
    // Delivery follows the highest rate in the order
    expect(s.lines[2]).toMatchObject({ description: "Delivery charges", hsn: "9965", rate: 18 })
    expect(s.total).toBe(1198 + 3499 + 79)
    expect(Math.round((s.taxable + s.cgst + s.sgst) * 100) / 100).toBe(s.total)
  })

  it("uses IGST for other states", () => {
    const s = gstSummary([{ description: "T-shirt", hsn: "6109", quantity: 1, total: 599 }], 0, "27", "29")
    expect(s.intraState).toBe(false)
    expect(s.lines[0]).toMatchObject({ cgst: 0, sgst: 0, igst: 28.52, taxable: 570.48 })
  })

  it("knows every state the shop's address form offers", () => {
    const source = readFileSync(path.resolve(__dirname, "../../../../storefront/src/lib/india.ts"), "utf8")
    const block = source.slice(source.indexOf("INDIAN_STATES"), source.indexOf("]", source.indexOf("INDIAN_STATES")))
    const states = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    expect(states.length).toBeGreaterThan(30)
    expect(states.filter((s) => !GST_STATE_CODES[s])).toEqual([])
  })

  it("dates invoices in the Indian financial year (IST)", () => {
    expect(financialYear(new Date("2026-04-01T00:00:00+05:30"))).toBe("2026-27")
    expect(financialYear(new Date("2026-03-31T23:59:00+05:30"))).toBe("2025-26")
    expect(financialYear(new Date("2027-01-15T10:00:00Z"))).toBe("2026-27")
  })
})
