import { retrieveCart } from "@lib/data/cart"
import { listProductsFor } from "@lib/data/catalog"
import { retrieveCustomer } from "@lib/data/customer"
import { getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import { lineDetails } from "@lib/util/line-details"
import BagView from "@modules/bag/bag-view"
import EmptyBag from "@modules/bag/empty-bag"
import { Metadata } from "next"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: t.bag.title, robots: { index: false } }
}

export default async function Cart(props: Props) {
  const locale = toLocale((await props.params).locale)
  const [cart, customer, products] = await Promise.all([
    retrieveCart().catch(() => null),
    retrieveCustomer().catch(() => null),
    listProductsFor(locale).catch(() => []),
  ])
  if (!cart?.items?.length) return <EmptyBag />

  const details = lineDetails(cart.items, products)
  return <BagView cart={cart} loggedIn={!!customer} details={details} />
}

// Personal pages: always rendered per request, never pre-built.
export const dynamic = "force-dynamic"
