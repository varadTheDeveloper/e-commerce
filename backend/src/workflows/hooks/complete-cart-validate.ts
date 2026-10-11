import { MedusaError } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { COD_PROVIDER_ID } from "../../lib/payment-ids"
import { deliveryEstimate } from "../../lib/shiprocket"

// Before an order is created (and before any payment is taken): refuse
// pincodes no courier serves, and cash on delivery where couriers cannot
// collect cash. When the courier check itself fails, the order goes ahead.
completeCartWorkflow.hooks.validate(async ({ cart }) => {
  const pincode = String((cart as any)?.shipping_address?.postal_code ?? "")
  if (!pincode) return
  const estimate = await deliveryEstimate(pincode).catch(() => null)
  if (!estimate?.checked) return
  if (!estimate.serviceable) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "We do not deliver to this pincode yet")
  }
  const sessions = ((cart as any)?.payment_collection?.payment_sessions ?? []) as { provider_id: string }[]
  if (!estimate.cod && sessions.some((s) => s.provider_id === COD_PROVIDER_ID)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Cash on delivery is not available for this pincode")
  }
})
