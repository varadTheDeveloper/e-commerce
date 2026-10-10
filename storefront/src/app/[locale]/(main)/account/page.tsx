import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"
import { format, getDictionary } from "@lib/i18n"
import { formatMobile } from "@lib/india"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import OrderList from "@modules/account/components/order-list"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: t.common.account, robots: { index: false } }
}

export default async function AccountOverview(props: Props) {
  const t = getDictionary((await props.params).locale)
  const customer = await retrieveCustomer().catch(() => null)
  if (!customer) notFound()
  const orders = (await listOrders(3, 0).catch(() => null)) ?? []

  const tiles = [
    { href: "/account/orders", label: t.account.orders },
    { href: "/account/addresses", label: t.account.addresses },
    { href: "/wishlist", label: t.wishlist.title },
    { href: "/account/profile", label: t.account.profile },
  ]

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="heading-lg" data-testid="account-hello">
          {format(t.account.hello, { name: customer.first_name || "" })}
        </h1>
        <p className="mt-1 text-sm text-muted">{formatMobile(customer.phone)}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2 small:grid-cols-4 small:gap-4">
        {tiles.map((tile) => (
          <li key={tile.href}>
            <LocalizedClientLink href={tile.href} className="flex h-20 items-center justify-center border border-line bg-white text-sm hover:border-ink">
              {tile.label}
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
      <section>
        <h2 className="eyebrow mb-4">{t.account.orders}</h2>
        <OrderList orders={orders} />
      </section>
    </div>
  )
}

export const dynamic = "force-dynamic"
