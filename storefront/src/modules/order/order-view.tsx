import { format } from "@lib/i18n"
import { Dictionary } from "@lib/i18n/dictionaries/en"
import { colourName } from "@lib/i18n/colours"
import { Locale } from "@lib/i18n/config"
import { formatMobile } from "@lib/india"
import { COD_PROVIDER_ID } from "@lib/util/checkout"
import { formatINR } from "@lib/util/money"
import { OrderTracking } from "@lib/data/orders"
import { HttpTypes } from "@medusajs/types"
import { LineDetails } from "@modules/bag/bag-view"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import CancelOrder from "./cancel-order"
import ReturnsSection from "./returns-section"
import { ReturnInfo } from "@lib/data/returns"

type Step = "placed" | "packed" | "shipped" | "out_for_delivery" | "delivered"
/** Which delivery steps the order has reached, and when. */
function deliverySteps(order: HttpTypes.StoreOrder, tracking: OrderTracking["tracking"]) {
  const fulfillment = (order.fulfillments ?? []).find((f) => !f.canceled_at)
  const seen = (stage: string) => tracking?.history?.find((h) => h.stage === stage)?.at
  const at: Record<Step, string | null | undefined> = {
    placed: String(order.created_at),
    packed: fulfillment ? String(fulfillment.packed_at ?? fulfillment.created_at) : null,
    shipped: fulfillment?.shipped_at ? String(fulfillment.shipped_at) : seen("shipped"),
    out_for_delivery: seen("out_for_delivery"),
    delivered: fulfillment?.delivered_at ? String(fulfillment.delivered_at) : seen("delivered"),
  }
  // A later step implies the earlier ones
  const order_: Step[] = ["placed", "packed", "shipped", "out_for_delivery", "delivered"]
  const last = Math.max(...order_.map((s, i) => (at[s] ? i : -1)))
  return {
    steps: order_.map((s, i) => ({ step: s, done: i <= last, at: at[s] })),
    shipped: last >= 2,
    note: tracking && ["delivery_failed", "returning", "returned"].includes(tracking.stage) ? (tracking.stage as "delivery_failed" | "returning" | "returned") : null,
    // From the courier's updates
    awb: tracking?.awb,
    trackingUrl: tracking?.url,
    courier: tracking?.courier,
  }
}

/** An order in the shop's design: after placing it, and under My orders. */
export default function OrderView({
  order,
  details,
  locale,
  t,
  placed,
  tracking,
  returns,
  returnSent,
}: {
  order: HttpTypes.StoreOrder
  tracking: OrderTracking
  details: Record<string, LineDetails>
  locale: Locale
  t: Dictionary
  /** Just placed: show the thank-you heading */
  placed?: boolean
  /** Return/exchange info (order details page only) */
  returns?: ReturnInfo | null
  returnSent?: boolean
}) {
  const o = t.order
  const providers = (order.payment_collections ?? []).flatMap((c) => (c.payments ?? []).map((p) => p.provider_id))
  const isCod = providers.includes(COD_PROVIDER_ID)
  const a = order.shipping_address
  const date = new Date(order.created_at).toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const status = o.statuses[order.status as keyof typeof o.statuses] ?? order.status
  const items = [...(order.items ?? [])].sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))
  const canceled = order.status === "canceled"
  const delivery = deliverySteps(order, tracking.tracking)
  const canCancel = !canceled && order.status !== "completed" && !delivery.shipped
  const shortDay = (d: string) =>
    new Date(d).toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })

  return (
    <div className="content-container max-w-3xl py-8 small:py-12" data-testid="order-view">
      {placed ? (
        <div className="mb-8 border border-line bg-white p-6 text-center" data-testid="order-placed">
          <p className="mx-auto mb-3 flex h-12 w-12 items-center justify-center bg-ink text-xl text-white" aria-hidden>
            ✓
          </p>
          <h1 className="heading-lg">{o.thanks}</h1>
          <p className="mt-2 text-muted">{o.note}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {placed ? (
            <h2 className="font-heading text-2xl" data-testid="order-number">{format(o.number, { number: order.display_id ?? "" })}</h2>
          ) : (
            <h1 className="heading-lg" data-testid="order-number">{format(o.number, { number: order.display_id ?? "" })}</h1>
          )}
          <p className="text-sm text-muted">
            {format(o.placedOn, { date })}
            {canceled && <> · {o.status}: {status}</>}
          </p>
        </div>
        <a href={`/api/invoice/${order.id}`} target="_blank" rel="noopener" className="btn-outline h-10 px-4 text-sm" data-testid="invoice-link">
          {o.invoice}
        </a>
      </div>

      {canceled ? (
        <section className="mt-6 border border-line bg-white p-5 text-sm" data-testid="order-canceled">
          <p className="font-medium">
            {format(o.canceledOn, { date: shortDay(String(tracking.canceled_at ?? order.updated_at)) })}
          </p>
          {!isCod && <p className="mt-1 text-muted">{o.refundNote}</p>}
        </section>
      ) : (
        <section className="mt-6 border border-line bg-white p-5" data-testid="order-tracking">
          <h2 className="eyebrow mb-4">{o.tracking}</h2>
          <ol className="grid grid-cols-5 gap-1 text-center text-[12px] small:text-[13px]">
            {delivery.steps.map(({ step, done, at }) => (
              <li key={step} className="flex flex-col items-center gap-2" data-testid={`track-${step}`} data-done={done}>
                <span className={`h-1.5 w-full ${done ? "bg-ink" : "bg-line"}`} aria-hidden />
                <span className={done ? "font-medium" : "text-muted"}>{o.steps[step]}</span>
                {done && at && <span className="text-muted">{shortDay(at)}</span>}
              </li>
            ))}
          </ol>
          {delivery.note && <p className="mt-4 bg-surface px-3 py-2 text-sm">{o.trackingNotes[delivery.note]}</p>}
          {delivery.awb && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {delivery.courier && <span>{format(o.courier, { name: delivery.courier })}</span>}
              <span className="text-muted">{format(o.trackingNumber, { awb: delivery.awb })}</span>
              {delivery.trackingUrl && (
                <a href={delivery.trackingUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" data-testid="track-link">
                  {o.trackParcel}
                </a>
              )}
            </div>
          )}
          {canCancel && (
            <div className="mt-4 border-t border-line pt-4">
              <CancelOrder orderId={order.id} />
            </div>
          )}
        </section>
      )}

      <section className="mt-4 border border-line bg-white p-5">
        <h2 className="eyebrow mb-4">{o.items}</h2>
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const d = details[item.id] ?? {}
            const image = d.image ?? item.thumbnail
            return (
              <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0" data-testid="order-item">
                <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden bg-surface">
                  {image && <Image src={image} alt="" fill sizes="64px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p>{d.title ?? item.product_title}</p>
                  <p className="text-[13px] text-muted">
                    {[d.size && `${t.bag.size}: ${d.size}`, d.colour && `${t.bag.colour}: ${colourName(d.colour, locale)}`, `× ${item.quantity}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="text-sm">{formatINR(Number(item.total ?? 0))}</p>
              </li>
            )
          })}
        </ul>
        <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt>{t.bag.delivery}</dt>
            <dd>{Number(order.shipping_total) > 0 ? formatINR(Number(order.shipping_total)) : t.checkout.free}</dd>
          </div>
          <div className="flex justify-between text-base font-medium">
            <dt>{t.bag.total}</dt>
            <dd data-testid="order-total">{formatINR(Number(order.total))}</dd>
          </div>
        </dl>
      </section>

      {returns !== undefined && <ReturnsSection orderId={order.id} info={returns} sent={returnSent} locale={locale} t={t} />}

      <div className="mt-4 grid gap-4 small:grid-cols-2">
        <section className="border border-line bg-white p-5 text-sm">
          <h2 className="eyebrow mb-3">{o.deliveryAddress}</h2>
          {a && (
            <p className="leading-relaxed text-muted">
              <span className="text-ink">{a.first_name}</span>
              <br />
              {[a.address_1, a.address_2].filter(Boolean).join(", ")}
              <br />
              {a.city}, {a.province} {a.postal_code}
              <br />
              {formatMobile(a.phone)}
            </p>
          )}
        </section>
        <section className="border border-line bg-white p-5 text-sm" data-testid="order-payment">
          <h2 className="eyebrow mb-3">{o.payment}</h2>
          <p>{isCod ? o.cod : o.paidOnline}</p>
          {isCod && !canceled && !delivery.steps[4].done && (
            <p className="mt-1 text-muted">{format(o.codDue, { amount: formatINR(Number(order.total)) })}</p>
          )}
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <LocalizedClientLink href="/account/orders" prefetch={false} className="btn-primary px-8">
          {o.myOrders}
        </LocalizedClientLink>
        <LocalizedClientLink href="/store" className="btn-outline px-8">
          {o.continueShopping}
        </LocalizedClientLink>
      </div>
    </div>
  )
}
