/**
 * Brand settings in one place. The brand name is a placeholder until the
 * client confirms it. Colours live in tailwind.config.js (`brand`, `accent`).
 *
 * Policy values (returns, free delivery) are shown on the site, so they must
 * match what the client actually offers. Set a value to null to hide it.
 */
export const BRAND = {
  name: "Vastra",
  /** Free delivery from this items total in rupees, or null if not offered.
   *  Must match SHOP.freeShippingFrom in backend/src/config/shop.ts (a test checks it). */
  freeDeliveryFrom: 999 as number | null,
  /** Delivery charge below freeDeliveryFrom (SHOP.shippingFee) */
  shippingFee: 79,
  /** Cash on delivery for orders up to this total (SHOP.codMaxOrder) */
  codMaxOrder: 5000,
  /** SHOP.returnWindowDays */
  returnDays: 7,
  cashOnDelivery: true,
  sourceCodeUrl: "https://github.com/varadTheDeveloper/e-commerce",
}
