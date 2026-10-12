import { readFileSync } from "fs"
import path from "path"
import { EMAILS, fillTemplate, langOf, MessageValues, SMS, smsValues, UpdateKind } from "../messages"

const KINDS: UpdateKind[] = ["placed", "shipped", "delivered", "canceled"]
const V: MessageValues = { brand: "Vastra", name: "Asha", order: "12", amount: "₹1,299", link: "https://x/o", cod: true, awb: "A1", courier: "C", trackingUrl: "https://t/A1" }

describe("order update messages", () => {
  it("has every message in every language", () => {
    for (const lang of ["mr", "hi", "en"] as const) {
      for (const kind of KINDS) {
        expect(EMAILS[lang][kind](V).subject).toContain("#12")
        expect(SMS[lang][kind]).toContain("{#var#}")
      }
    }
  })

  it("fills exactly as many values as each SMS template has blanks", () => {
    for (const lang of ["mr", "hi", "en"] as const) {
      for (const kind of KINDS) {
        const blanks = SMS[lang][kind].match(/\{#var#\}/g)!.length
        expect(smsValues(kind, V)).toHaveLength(blanks)
        expect(fillTemplate(SMS[lang][kind], smsValues(kind, V))).not.toContain("{#var#}")
      }
    }
    expect(fillTemplate(SMS.en.placed, smsValues("placed", V))).toBe("Your Vastra order #12 of Rs.1,299 is placed. Details: https://x/o")
  })

  it("picks the order's language, Marathi by default", () => {
    expect(langOf("hi-IN")).toBe("hi")
    expect(langOf("en-IN")).toBe("en")
    expect(langOf("mr-IN")).toBe("mr")
    expect(langOf(null)).toBe("mr")
  })

  it("lists the exact SMS texts in the setup guide (DLT needs them word for word)", () => {
    const guide = readFileSync(path.resolve(__dirname, "../../../../docs/SETUP-SHIPPING.md"), "utf8")
    for (const lang of ["mr", "hi", "en"] as const) {
      for (const kind of KINDS) {
        expect(guide).toContain(`| \`${kind}.${lang}\` | ${SMS[lang][kind]} |`)
      }
    }
  })
})
