import { listProductsFor } from "@lib/data/catalog"
import { retrieveCustomer } from "@lib/data/customer"
import { retrieveOrder } from "@lib/data/orders"
import { format, getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import { lineDetails } from "@lib/util/line-details"
import OrderView from "@modules/order/order-view"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const t = getDictionary(params.locale)
  const order = await retrieveOrder(params.id).catch(() => null)
  return { title: order ? format(t.order.number, { number: order.display_id ?? "" }) : t.order.notFound, robots: { index: false } }
}

export default async function OrderDetailPage(props: Props) {
  const params = await props.params
  const locale = toLocale(params.locale)
  const [order, customer, products] = await Promise.all([
    retrieveOrder(params.id).catch(() => null),
    retrieveCustomer().catch(() => null),
    listProductsFor(locale).catch(() => []),
  ])
  // Only the customer's own orders
  if (!order || !customer || order.customer_id !== customer.id) notFound()
  return <OrderView order={order} details={lineDetails(order.items ?? [], products)} locale={locale} t={getDictionary(locale)} />
}
