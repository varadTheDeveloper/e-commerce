import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getDictionary } from "@lib/i18n"
import BagView from "@modules/bag/bag-view"
import EmptyBag from "@modules/bag/empty-bag"
import { Metadata } from "next"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: t.bag.title, robots: { index: false } }
}

export default async function Cart() {
  const [cart, customer] = await Promise.all([retrieveCart().catch(() => null), retrieveCustomer().catch(() => null)])
  if (!cart?.items?.length) return <EmptyBag />
  return <BagView cart={cart} loggedIn={!!customer} />
}

// Personal pages: always rendered per request, never pre-built.
export const dynamic = "force-dynamic"
