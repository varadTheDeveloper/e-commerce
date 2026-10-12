import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rejectRequest } from "../../../../../lib/return-actions"

/** POST /admin/return-requests/:id/reject { reason } — the customer sees the reason. */
export const POST = async (req: MedusaRequest<{ reason: string }>, res: MedusaResponse) => {
  res.json({ return_request: await rejectRequest(req.scope, req.params.id, req.validatedBody.reason) })
}
