// Shop rules for checkout, in one place. Amounts in rupees.
// The seed uses the shipping values to create the delivery option; after
// launch, change delivery prices in the admin panel (Settings → Locations &
// Shipping) and keep these numbers in step.

export const SHOP = {
  /** Delivery is free when the items total at least this much */
  freeShippingFrom: 999,
  /** Delivery charge below that */
  shippingFee: 79,
  /** Cash on delivery only for orders up to this total (delivery included) */
  codMaxOrder: 5000,
} as const
