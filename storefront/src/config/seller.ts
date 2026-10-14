/**
 * Seller details shown on the legal pages, as India's Consumer Protection
 * (E-Commerce) Rules 2020 require. PLACEHOLDERS for testing: the client gives
 * the real ones before launch. Name, GSTIN and email must match
 * backend/src/config/seller.ts (printed on invoices; a test checks).
 */
export const SELLER = {
  legalName: "Vastra Clothing (placeholder)",
  address: "Shop address line 1, Jalna, Maharashtra 431203",
  /** Courts for disputes (Terms of use) */
  city: "Jalna",
  gstin: "27AAAAA0000A1Z5",
  email: "support@example.com",
  phone: "+91 90000 00000",
  /** Customer care hours, in English; the pages translate the days */
  hours: { from: "10:00", to: "18:00" },
  /** Grievance officer (E-Commerce Rules 2020, rule 4) */
  grievance: {
    name: "Officer name (placeholder)",
    email: "grievance@example.com",
    phone: "+91 90000 00000",
  },
  /** Shown as "Last updated" on the legal pages */
  policiesUpdated: "2026-10-12",
  /** Shows a "draft for testing" notice on the legal pages until a lawyer has checked them */
  policiesDraft: true,
} as const
