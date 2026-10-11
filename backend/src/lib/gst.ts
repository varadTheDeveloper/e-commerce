// GST on clothing sold to customers in India. Shop prices include GST.
//
// Rates (from 22 September 2025): 5% when a piece's value before GST is up to
// ₹2,500, 18% above. Each piece is judged on its own price after discounts.
// Delivery charges follow the main item (composite supply): the highest rate
// in the order. Confirm these rules with the accountant before launch.
//
// Same state as the seller: CGST + SGST (half each); other states: IGST.

export const LOW_RATE = 5
export const HIGH_RATE = 18
export const LOW_RATE_MAX_VALUE = 2500

const round2 = (n: number) => Math.round(n * 100) / 100

/** GST rate for one piece sold at `unitPrice` (GST included). */
export function clothingRate(unitPrice: number): number {
  return unitPrice / (1 + LOW_RATE / 100) <= LOW_RATE_MAX_VALUE ? LOW_RATE : HIGH_RATE
}

export type GstLineInput = {
  description: string
  hsn: string
  quantity: number
  /** Line total after discounts, GST included */
  total: number
}

export type GstLine = GstLineInput & {
  rate: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
}

export type GstSummary = {
  lines: GstLine[]
  intraState: boolean
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

function split(line: GstLineInput, rate: number, intraState: boolean): GstLine {
  const taxable = round2(line.total / (1 + rate / 100))
  const tax = round2(line.total - taxable)
  const half = round2(tax / 2)
  return {
    ...line,
    rate,
    taxable,
    cgst: intraState ? half : 0,
    sgst: intraState ? round2(tax - half) : 0,
    igst: intraState ? 0 : tax,
  }
}

/**
 * Splits the order's lines (and delivery charge, if any) into taxable value
 * and GST. Totals add up exactly to what the customer paid.
 */
export function gstSummary(
  items: GstLineInput[],
  shipping: number,
  sellerStateCode: string,
  buyerStateCode: string | null
): GstSummary {
  const intraState = !buyerStateCode || buyerStateCode === sellerStateCode
  const lines = items.map((i) => split(i, clothingRate(i.total / Math.max(1, i.quantity)), intraState))
  if (shipping > 0) {
    const rate = Math.max(LOW_RATE, ...lines.map((l) => l.rate))
    lines.push(split({ description: "Delivery charges", hsn: "9965", quantity: 1, total: shipping }, rate, intraState))
  }
  const sum = (k: "taxable" | "cgst" | "sgst" | "igst" | "total") => round2(lines.reduce((a, l) => a + l[k], 0))
  return { lines, intraState, taxable: sum("taxable"), cgst: sum("cgst"), sgst: sum("sgst"), igst: sum("igst"), total: sum("total") }
}

/** Indian financial year of a date, e.g. "2026-27" (April to March, IST). */
export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
  const year = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`
}

/** GST state codes by state name (as stored in addresses). */
export const GST_STATE_CODES: Record<string, string> = {
  "Jammu and Kashmir": "01", "Himachal Pradesh": "02", Punjab: "03", Chandigarh: "04", Uttarakhand: "05",
  Haryana: "06", Delhi: "07", Rajasthan: "08", "Uttar Pradesh": "09", Bihar: "10", Sikkim: "11",
  "Arunachal Pradesh": "12", Nagaland: "13", Manipur: "14", Mizoram: "15", Tripura: "16", Meghalaya: "17",
  Assam: "18", "West Bengal": "19", Jharkhand: "20", Odisha: "21", Chhattisgarh: "22", "Madhya Pradesh": "23",
  Gujarat: "24", "Dadra and Nagar Haveli and Daman and Diu": "26", Maharashtra: "27", Karnataka: "29",
  Goa: "30", Lakshadweep: "31", Kerala: "32", "Tamil Nadu": "33", Puducherry: "34",
  "Andaman and Nicobar Islands": "35", Telangana: "36", "Andhra Pradesh": "37", Ladakh: "38",
}
