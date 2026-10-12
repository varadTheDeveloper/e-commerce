import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { receiveRequest } from "../../../../../lib/return-actions"

/** POST /admin/return-requests/:id/receive */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json({ return_request: await receiveRequest(req.scope, req.params.id) })
}
