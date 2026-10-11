import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { invoiceForOrder } from "../../../../../lib/invoice"
import { renderInvoicePdf } from "../../../../../lib/invoice-pdf"

/** GET /store/orders/:id/invoice — the GST invoice (PDF) for the logged-in customer's order. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const invoice = await invoiceForOrder(req.scope, req.params.id, req.auth_context.actor_id)
  if (!invoice) {
    return res.status(404).json({ type: "not_found", message: "Order not found" })
  }
  const pdf = await renderInvoicePdf(invoice)
  res.setHeader("content-type", "application/pdf")
  res.setHeader("content-disposition", `inline; filename="invoice-${invoice.number.replace(/\//g, "-")}.pdf"`)
  res.setHeader("cache-control", "private, no-store")
  res.send(pdf)
}
