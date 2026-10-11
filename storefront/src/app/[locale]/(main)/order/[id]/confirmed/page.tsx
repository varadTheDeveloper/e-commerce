import { listProductsFor } from "@lib/data/catalog"
import { retrieveCustomer } from "@lib/data/customer"
import { retrieveOrder, retrieveOrderTracking } from "@lib/data/orders"
import { getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import { lineDetails } from "@lib/util/line-details"
import OrderView from "@modules/order/order-view"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: t.order.thanks, robots: { index: false } }
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  const locale = toLocale(params.locale)
  const [order, customer, products, tracking] = await Promise.all([
    retrieveOrder(params.id).catch(() => null),
    retrieveCustomer().catch(() => null),
    listProductsFor(locale).catch(() => []),
    retrieveOrderTracking(params.id),
  ])
  // Shows the address and phone: only for the customer who placed it
  if (!order || !customer || order.customer_id !== customer.id) notFound()
  return <OrderView order={order} details={lineDetails(order.items ?? [], products)} locale={locale} t={getDictionary(locale)} tracking={tracking} placed />
}

// Personal pages: always rendered per request, never pre-built.
export const dynamic = "force-dynamic"
