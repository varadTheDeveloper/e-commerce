import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteAccount, openBusiness } from "../../../../../lib/delete-account"

/**
 * POST /store/customers/me/delete — the customer deletes their own account.
 * Refused while an order is on its way or a return is being handled
 * (type "open_orders"), so those can still be finished.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const open = await openBusiness(req.scope, customerId)
  if (open.orders || open.returns) {
    res.status(409).json({ type: "open_orders", message: "Some orders or returns are not finished yet.", ...open })
    return
  }
  await deleteAccount(req.scope, customerId, req.auth_context.auth_identity_id)
  res.json({ deleted: true })
}
