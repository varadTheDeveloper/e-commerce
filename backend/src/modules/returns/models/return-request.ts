import { model } from "@medusajs/framework/utils"

/**
 * A customer's request to return items for a refund, or to exchange them for
 * another size. Staff approve or reject it; the courier picks the items up;
 * staff mark them received; then the refund (or the new size) goes out.
 */
const ReturnRequest = model
  .define("return_request", {
    id: model.id({ prefix: "rreq" }).primaryKey(),
    order_id: model.text(),
    customer_id: model.text(),
    /** "return" (refund) or "exchange" (another size) */
    type: model.enum(["return", "exchange"]),
    status: model
      .enum(["requested", "approved", "rejected", "picked_up", "received", "refund_due", "refunded", "completed", "cancelled"])
      .default("requested"),
    /** [{ line_item_id, quantity, reason, note?, exchange_variant_id? }] */
    items: model.json(),
    /** Photo URLs the customer added (required for damaged or wrong items) */
    photos: model.json().nullable(),
    /** COD orders only: where to send the refund. Deleted once refunded. */
    refund_details: model.json().nullable(),
    refund_amount: model.number().nullable(),
    refund_reference: model.text().nullable(),
    reject_reason: model.text().nullable(),
    /** Medusa return / exchange created when approved */
    medusa_return_id: model.text().nullable(),
    medusa_exchange_id: model.text().nullable(),
    /** Courier pickup: { shiprocket_order_id, shipment_id, awb, courier, tracking_url } or { error } */
    pickup: model.json().nullable(),
    /** The pickup's tracking number, to match courier updates */
    pickup_awb: model.text().nullable(),
    locale: model.text().nullable(),
  })
  .indexes([{ on: ["order_id"] }, { on: ["customer_id"] }, { on: ["status"] }, { on: ["pickup_awb"] }])

export default ReturnRequest
