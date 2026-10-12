// Seller details printed on GST invoices. PLACEHOLDERS: the client must give
// the real legal name, address and GSTIN before launch (the GSTIN is public
// information, so it may live in this public repository).

export const SELLER = {
  /** Shop name in emails and SMS (same STORE_NAME the seed uses; placeholder until the brand is named) */
  brandName: process.env.STORE_NAME || "Vastra",
  legalName: "Vastra Clothing (placeholder)",
  address: ["Shop address line 1", "Jalna, Maharashtra 431203"],
  gstin: "27AAAAA0000A1Z5",
  /** GST state code of the seller (27 = Maharashtra) */
  stateCode: "27",
  state: "Maharashtra",
  email: "support@example.com",
  /** Pickup address as named in the Shiprocket panel (Settings → Pickup addresses), and its pincode */
  pickupLocation: "Primary",
  pickupPincode: "431203",
  /** Where returned items are sent (usually the same place as the pickup address) */
  warehouse: {
    name: "Vastra Warehouse",
    address: "Shop address line 1",
    city: "Jalna",
    state: "Maharashtra",
    pincode: "431203",
    phone: "9000000000",
  },
  /** Invoice numbers look like VS/2026-27/000123 (max 16 characters) */
  invoicePrefix: "VS",
} as const
