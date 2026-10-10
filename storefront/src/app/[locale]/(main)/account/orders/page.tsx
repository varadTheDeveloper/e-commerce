import { listOrders } from "@lib/data/orders"
import { getDictionary } from "@lib/i18n"
import OrderList from "@modules/account/components/order-list"
import { Metadata } from "next"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: t.account.orders, robots: { index: false } }
}

export default async function Orders(props: Props) {
  const t = getDictionary((await props.params).locale)
  const orders = (await listOrders(50, 0).catch(() => null)) ?? []
  return (
    <div className="flex flex-col gap-6" data-testid="orders-page-wrapper">
      <h1 className="heading-lg">{t.account.orders}</h1>
      <OrderList orders={orders} />
    </div>
  )
}

export const dynamic = "force-dynamic"
