import { listProductsFor } from "@lib/data/catalog"
import { retrieveCustomer } from "@lib/data/customer"
import { retrieveOrder } from "@lib/data/orders"
import { getReturnInfo } from "@lib/data/returns"
import { format, getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import { lineDetails } from "@lib/util/line-details"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ReturnForm from "@modules/order/return-form"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  return { title: getDictionary(params.locale).returns.title, robots: { index: false } }
}

export default async function ReturnPage(props: Props) {
  const params = await props.params
  const locale = toLocale(params.locale)
  const t = getDictionary(locale)
  const [order, customer, info, products] = await Promise.all([
    retrieveOrder(params.id).catch(() => null),
    retrieveCustomer().catch(() => null),
    getReturnInfo(params.id),
    listProductsFor(locale).catch(() => []),
  ])
  // Only the customer's own orders
  if (!order || !customer || order.customer_id !== customer.id || !info) notFound()
  const canAsk = info.open && info.items.some((i) => i.returnable)

  return (
    <div className="content-container max-w-3xl py-8 small:py-12" data-testid="return-page">
      <LocalizedClientLink href={`/account/orders/details/${order.id}`} className="text-sm text-muted underline underline-offset-4">
        ← {format(t.order.number, { number: order.display_id ?? "" })}
      </LocalizedClientLink>
      <h1 className="heading-lg mb-6 mt-3">{t.returns.title}</h1>
      {canAsk ? (
        <ReturnForm orderId={order.id} info={info} details={lineDetails(order.items ?? [], products)} />
      ) : (
        <p className="border border-line bg-white p-5 text-sm" data-testid="returns-closed">
          {info.open ? t.returns.nothingLeft : t.returns.closed}
        </p>
      )}
    </div>
  )
}
