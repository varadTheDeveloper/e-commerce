import { BRAND } from "@config/brand"
import { SELLER } from "@config/seller"
import { format } from "@lib/i18n"
import { Locale } from "@lib/i18n/config"
import en, { PolicyPage, PolicySlug, PolicyTexts, POLICY_SLUGS } from "./en"
import hi from "./hi"
import mr from "./mr"

export { POLICY_SLUGS }
export type { PolicySlug }

const TEXTS: Record<Locale, PolicyTexts> = { en, hi, mr }

/** A legal/help page in one language, with the shop's details filled in. */
export function getPolicy(locale: Locale, slug: PolicySlug) {
  const texts = TEXTS[locale]
  const values: Record<string, string | number> = {
    brand: BRAND.name,
    legalName: SELLER.legalName,
    address: SELLER.address,
    city: SELLER.city,
    gstin: SELLER.gstin,
    email: SELLER.email,
    phone: SELLER.phone,
    days: texts.days,
    hoursFrom: SELLER.hours.from,
    hoursTo: SELLER.hours.to,
    grievanceName: SELLER.grievance.name,
    grievanceEmail: SELLER.grievance.email,
    grievancePhone: SELLER.grievance.phone,
    freeFrom: (BRAND.freeDeliveryFrom ?? 0).toLocaleString("en-IN"),
    fee: BRAND.shippingFee,
    codMax: BRAND.codMaxOrder.toLocaleString("en-IN"),
    returnDays: BRAND.returnDays,
  }
  const fill = (s: string) => format(s, values)
  const page: PolicyPage = texts.pages[slug]
  const date = new Date(SELLER.policiesUpdated).toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })
  return {
    title: fill(page.title),
    description: fill(page.description),
    intro: page.intro ? fill(page.intro) : undefined,
    sections: page.sections.map((s) => ({ heading: fill(s.heading), body: s.body.map(fill) })),
    updated: format(texts.updated, { date }),
    draft: SELLER.policiesDraft ? texts.draft : null,
  }
}
