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
  /** Parcel size when a product has no weight of its own (courier bookings) */
  defaultPackage: { weightGrams: 500, lengthCm: 30, breadthCm: 25, heightCm: 5 },
  /** Weight of one piece when the product has none */
  defaultItemGrams: 300,
  /** Days after delivery during which items can be returned or exchanged */
  returnWindowDays: 7,
} as const
