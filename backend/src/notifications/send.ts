import { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SELLER } from "../config/seller"
import { maskPhone, normalizeIndianMobile } from "../lib/phone"
import { smsConfigFromEnv } from "../lib/sms"
import { sendMessageCentralSms } from "../lib/sms/messagecentral"
import { COD_PROVIDER_ID } from "../lib/payment-ids"
import { trackingUrl } from "../modules/shiprocket/service"
import { EMAILS, fillTemplate, langOf, MessageValues, SMS, smsValues, UpdateKind } from "./messages"

// Order updates by email (Resend) and SMS (Message Central MessageNow).
// Settings (environment):
//   RESEND_API_KEY, EMAIL_FROM ("Shop <orders@brand.in>"), ORDER_ALERT_EMAIL (shop's inbox)
//   STOREFRONT_URL (links in messages)
//   SMS_ORDER_UPDATES=true, MESSAGECENTRAL_SENDER_ID, MESSAGECENTRAL_ENTITY_ID,
//   SMS_TEMPLATE_IDS ({"placed.mr":"<DLT template id>", ...})
//   RESEND_API_BASE (tests only)
// Without email settings, emails are written to the log (no addresses or text).
// Sending never stops an order: failures are logged.

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

export function storefrontUrl() {
  return (process.env.STOREFRONT_URL || "http://localhost:8000").replace(/\/+$/, "")
}

export async function sendEmail(
  email: { to: string; subject: string; html: string; text: string },
  logger: Logger,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!key || !from) {
    logger.info(`[email:log] "${email.subject}" (email not set up)`)
    return false
  }
  const base = (process.env.RESEND_API_BASE || "https://api.resend.com").replace(/\/+$/, "")
  const res = await fetchImpl(`${base}/emails`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    throw new Error(`Resend refused the email (HTTP ${res.status})`)
  }
  return true
}

export function renderEmail(lines: string[], button: string, link: string) {
  const shown = lines.filter(Boolean)
  const html = `<!doctype html><html><body style="margin:0;background:#fbf9f6;font-family:Mukta,Arial,sans-serif;color:#1c1b19">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font-size:22px;letter-spacing:4px;text-transform:uppercase;margin:0 0 24px">${escapeHtml(SELLER.brandName)}</p>
${shown.map((l) => `<p style="font-size:16px;line-height:1.5;margin:0 0 12px">${escapeHtml(l)}</p>`).join("\n")}
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#1c1b19;color:#fff;padding:12px 24px;text-decoration:none;display:inline-block">${escapeHtml(button)}</a></p>
</div></body></html>`
  const text = [...shown, "", `${button}: ${link}`].join("\n")
  return { html, text }
}

type SmsTemplateIds = Record<string, string>

function smsTemplateIds(): SmsTemplateIds {
  try {
    const parsed = JSON.parse(process.env.SMS_TEMPLATE_IDS || "{}")
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/** Sends an order update SMS when SMS updates are switched on and the template is registered. */
async function sendUpdateSms(phone: string, kind: UpdateKind, v: MessageValues, lang: ReturnType<typeof langOf>, logger: Logger) {
  if (process.env.SMS_ORDER_UPDATES !== "true") return false
  const config = smsConfigFromEnv()
  const templateId = smsTemplateIds()[`${kind}.${lang}`]
  const senderId = process.env.MESSAGECENTRAL_SENDER_ID
  const entityId = process.env.MESSAGECENTRAL_ENTITY_ID
  if (config.provider !== "messagecentral" || !templateId || !senderId || !entityId) {
    logger.warn(`Order SMS "${kind}.${lang}" not sent: SMS updates are not fully set up`)
    return false
  }
  await sendMessageCentralSms(phone, fillTemplate(SMS[lang][kind], smsValues(kind, v)), { senderId, entityId, templateId }, config)
  return true
}

/**
 * Sends the customer an update about their order (email if they gave one,
 * SMS when set up), and the shop an email for each new order.
 */
export async function notifyOrder(container: MedusaContainer, orderId: string, kind: UpdateKind): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "locale",
      "email",
      "total",
      "customer.email",
      "customer.phone",
      "customer.first_name",
      "shipping_address.first_name",
      "shipping_address.phone",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
      "fulfillments.data",
      "fulfillments.canceled_at",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as any
  if (!order) return

  const lang = langOf(order.locale)
  const payments = (order.payment_collections ?? []).flatMap((c: any) => c.payments ?? [])
  const cod = payments.some((p: any) => p.provider_id === COD_PROVIDER_ID)
  const shipment = (order.fulfillments ?? []).find((f: any) => !f.canceled_at && f.data?.awb)?.data
  const link = `${storefrontUrl()}/${lang}/account/orders/details/${order.id}`
  const values: MessageValues = {
    brand: SELLER.brandName,
    name: order.customer?.first_name || order.shipping_address?.first_name || "",
    order: String(order.display_id),
    amount: rupees(Number(order.total)),
    link,
    cod,
    courier: shipment?.courier,
    awb: shipment?.awb,
    trackingUrl: shipment?.awb ? trackingUrl(shipment.awb) : undefined,
    refund: kind === "canceled" && !cod && payments.some((p: any) => p.captured_at),
  }

  const to = order.email || order.customer?.email
  if (to) {
    const { subject, lines, button } = EMAILS[lang][kind](values)
    const { html, text } = renderEmail(lines, button, kind === "shipped" && values.trackingUrl ? values.trackingUrl : link)
    await sendEmail({ to, subject, html, text }, logger).catch((e) => logger.error(`Order email (${kind}) failed: ${e.message}`))
  }

  const phone = normalizeIndianMobile(order.customer?.phone ?? order.shipping_address?.phone)
  if (phone) {
    await sendUpdateSms(phone, kind, values, lang, logger).catch((e) =>
      logger.error(`Order SMS (${kind}) to ${maskPhone(phone)} failed: ${e.message}`)
    )
  }

  const alert = process.env.ORDER_ALERT_EMAIL
  if (kind === "placed" && alert) {
    const { html, text } = renderEmail(
      [`New order #${values.order}: ${values.amount}, ${cod ? "cash on delivery" : "paid online"}.`],
      "Open in admin",
      `${(process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")}/app/orders/${order.id}`
    )
    await sendEmail({ to: alert, subject: `New order #${values.order} – ${values.amount}`, html, text }, logger).catch((e) =>
      logger.error(`Shop order alert failed: ${e.message}`)
    )
  }
}
