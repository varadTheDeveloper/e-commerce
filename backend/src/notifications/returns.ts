import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SELLER } from "../config/seller"
import { maskRefundDetails } from "../lib/returns"
import { RETURNS_MODULE } from "../modules/returns"
import { langOf } from "./messages"
import { RETURN_EMAILS, ReturnKind } from "./return-messages"
import { renderEmail, sendEmail, storefrontUrl } from "./send"

const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

/** Emails the customer about their return or exchange request (if they gave an email). */
export async function notifyReturn(scope: MedusaContainer, requestId: string, kind: ReturnKind): Promise<void> {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const request = await (scope.resolve(RETURNS_MODULE) as any).retrieveReturnRequest(requestId)
    const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["id", "display_id", "email", "locale", "customer.email", "customer.first_name", "shipping_address.first_name"],
      filters: { id: request.order_id },
    })
    const order = data[0] as any
    const to = order?.email || order?.customer?.email
    if (!to) return
    const lang = langOf(request.locale ?? order.locale)
    const { subject, lines, button } = RETURN_EMAILS[lang][kind]({
      brand: SELLER.brandName,
      name: order.customer?.first_name || order.shipping_address?.first_name || "",
      order: String(order.display_id),
      exchange: request.type === "exchange",
      amount: rupees(Number(request.refund_amount ?? 0)),
      refundTo: request.refund_details ? maskRefundDetails(request.refund_details) : undefined,
      online: !request.refund_details,
      rejectReason: request.reject_reason ?? undefined,
      pickupAwb: request.pickup?.awb,
    })
    const { html, text } = renderEmail(lines, button, `${storefrontUrl()}/${lang}/account/orders/details/${order.id}`)
    await sendEmail({ to, subject, html, text }, logger)
  } catch (e) {
    logger.error(`Return email (${kind}) failed: ${e instanceof Error ? e.message : e}`)
  }
}
