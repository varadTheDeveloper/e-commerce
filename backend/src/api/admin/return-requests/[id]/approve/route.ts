import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { approveRequest } from "../../../../../lib/return-actions"

/** POST /admin/return-requests/:id/approve */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json({ return_request: await approveRequest(req.scope, req.params.id) })
}
