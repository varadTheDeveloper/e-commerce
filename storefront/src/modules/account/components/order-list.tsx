"use client"

import { format } from "@lib/i18n"
import { useI18n } from "@lib/i18n/provider"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function OrderList({ orders }: { orders: HttpTypes.StoreOrder[] }) {
  const { locale, t } = useI18n()
  if (!orders.length) {
    return (
      <div className="flex flex-col items-start gap-4 bg-surface p-6">
        <p className="text-muted">{t.account.noOrders}</p>
        <LocalizedClientLink href="/store" className="btn-primary px-8">
          {t.account.startShopping}
        </LocalizedClientLink>
      </div>
    )
  }
  const date = (d: string | Date) =>
    new Date(d).toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, { day: "numeric", month: "long", year: "numeric" })
  return (
    <ul className="divide-y divide-line border-y border-line">
      {orders.map((o) => (
        <li key={o.id} className="flex items-center justify-between gap-4 py-4" data-testid="order-row">
          <div>
            <p className="font-medium">{format(t.account.order, { number: o.display_id ?? "" })}</p>
            <p className="text-sm text-muted">
              {format(t.account.placedOn, { date: date(o.created_at) })} ·{" "}
              {format(t.account.items, { count: o.items?.reduce((n, i) => n + i.quantity, 0) ?? 0 })} ·{" "}
              {convertToLocale({ amount: o.total, currency_code: o.currency_code })}
            </p>
          </div>
          <LocalizedClientLink href={`/account/orders/details/${o.id}`} className="text-sm underline underline-offset-4">
            {t.account.viewOrder}
          </LocalizedClientLink>
        </li>
      ))}
    </ul>
  )
}
