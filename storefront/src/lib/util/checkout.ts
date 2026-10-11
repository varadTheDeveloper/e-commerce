// Shared by the checkout page and its server actions.

export const RAZORPAY_PROVIDER_ID = "pp_razorpay_razorpay"
export const COD_PROVIDER_ID = "pp_cod_cod"

export const CHECKOUT_CART_FIELDS =
  "*items, +items.total, +items.compare_at_unit_price, *items.variant, *shipping_address, *shipping_methods, " +
  "+total, +item_total, +shipping_total, +customer_id, *payment_collection, *payment_collection.payment_sessions"
