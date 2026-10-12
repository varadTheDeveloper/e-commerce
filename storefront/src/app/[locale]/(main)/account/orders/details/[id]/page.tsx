import { listProductsFor } from "@lib/data/catalog"
import { retrieveCustomer } from "@lib/data/customer"
import { retrieveOrder, retrieveOrderTracking } from "@lib/data/orders"
import { getReturnInfo } from "@lib/data/returns"
import { format, getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import { lineDetails } from "@lib/util/line-details"
import OrderView from "@modules/order/order-view"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ return?: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const t = getDictionary(params.locale)
  const order = await retrieveOrder(params.id).catch(() => null)
  return { title: order ? format(t.order.number, { number: order.display_id ?? "" }) : t.order.notFound, robots: { index: false } }
}

export default async function OrderDetailPage(props: Props) {
  const params = await props.params
  const locale = toLocale(params.locale)
  const { return: returnParam } = await props.searchParams
  const [order, customer, products, tracking, returns] = await Promise.all([
    retrieveOrder(params.id).catch(() => null),
    retrieveCustomer().catch(() => null),
    listProductsFor(locale).catch(() => []),
    retrieveOrderTracking(params.id),
    getReturnInfo(params.id),
  ])
  // Only the customer's own orders
  if (!order || !customer || order.customer_id !== customer.id) notFound()
  return (
    <OrderView
      order={order}
      details={lineDetails(order.items ?? [], products)}
      locale={locale}
      t={getDictionary(locale)}
      tracking={tracking}
      returns={returns}
      returnSent={returnParam === "sent"}
    />
  )
}
