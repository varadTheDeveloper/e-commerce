import { ReturnInfo } from "@lib/data/returns"
import { format } from "@lib/i18n"
import { Dictionary } from "@lib/i18n/dictionaries/en"
import { Locale } from "@lib/i18n/config"
import { formatINR } from "@lib/util/money"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/** Return and exchange requests of an order, and the way to start one. */
export default function ReturnsSection({
  orderId,
  info,
  sent,
  locale,
  t,
}: {
  orderId: string
  info: ReturnInfo | null
  /** Just sent a request */
  sent?: boolean
  locale: Locale
  t: Dictionary
}) {
  const r = t.returns
  // Nothing to show before delivery
  if (!info || (!info.window_ends_at && !info.requests.length)) return null
  const canAsk = info.open && info.items.some((i) => i.returnable)
  const day = (d: string) =>
    new Date(d).toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, { day: "numeric", month: "long", timeZone: "Asia/Kolkata" })

  return (
    <section className="mt-4 border border-line bg-white p-5 text-sm" data-testid="order-returns">
      <h2 className="eyebrow mb-3">{r.section}</h2>
      {sent && (
        <p role="status" className="mb-4 bg-surface px-3 py-2" data-testid="return-sent">
          {r.sent}
        </p>
      )}
      {!!info.requests.length && (
        <ul className="mb-4 divide-y divide-line">
          {info.requests.map((q) => {
            const pieces = q.items.reduce((sum, i) => sum + i.quantity, 0)
            return (
              <li key={q.id} className="flex flex-col gap-1 py-3 first:pt-0" data-testid="return-request" data-status={q.status}>
                <p className="flex flex-wrap justify-between gap-2">
                  <span>
                    {format(r.requestLine, { type: r.typeNames[q.type], count: pieces })} · <span className="text-muted">{day(q.created_at)}</span>
                  </span>
                  <span className="font-medium">{(r.status as Record<string, string>)[q.status] ?? q.status}</span>
                </p>
                {q.type === "return" && q.refund_amount != null && q.status !== "rejected" && (
                  <p className="text-muted">{format(r.refundAmount, { amount: formatINR(q.refund_amount) })}</p>
                )}
                {q.reject_reason && <p className="text-muted">{format(r.rejectReason, { reason: q.reject_reason })}</p>}
                {q.pickup?.tracking_url && ["approved", "picked_up"].includes(q.status) && (
                  <a href={q.pickup.tracking_url} target="_blank" rel="noopener noreferrer" className="self-start underline underline-offset-4">
                    {r.trackPickup}
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {canAsk ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <LocalizedClientLink href={`/account/orders/details/${orderId}/return`} className="btn-outline h-10 px-4" data-testid="start-return">
            {r.start}
          </LocalizedClientLink>
          {info.window_ends_at && <span className="text-muted">{format(r.openUntil, { date: day(info.window_ends_at) })}</span>}
        </div>
      ) : (
        !info.open && <p className="text-muted">{r.closed}</p>
      )}
    </section>
  )
}
