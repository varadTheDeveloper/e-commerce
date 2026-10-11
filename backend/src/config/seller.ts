// Seller details printed on GST invoices. PLACEHOLDERS: the client must give
// the real legal name, address and GSTIN before launch (the GSTIN is public
// information, so it may live in this public repository).

export const SELLER = {
  legalName: "Vastra Clothing (placeholder)",
  address: ["Shop address line 1", "Jalna, Maharashtra 431203"],
  gstin: "27AAAAA0000A1Z5",
  /** GST state code of the seller (27 = Maharashtra) */
  stateCode: "27",
  state: "Maharashtra",
  email: "support@example.com",
  /** Invoice numbers look like VS/2026-27/000123 (max 16 characters) */
  invoicePrefix: "VS",
} as const
