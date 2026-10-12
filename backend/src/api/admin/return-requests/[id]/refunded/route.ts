import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { markRefunded } from "../../../../../lib/return-actions"

/** POST /admin/return-requests/:id/refunded { reference } — a COD refund was sent (UPI/bank reference). */
export const POST = async (req: MedusaRequest<{ reference: string }>, res: MedusaResponse) => {
  res.json({ return_request: await markRefunded(req.scope, req.params.id, req.validatedBody.reference) })
}
