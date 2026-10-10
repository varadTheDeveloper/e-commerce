import { retrieveCart } from "@lib/data/cart"
import { listProductsFor } from "@lib/data/catalog"
import { retrieveCustomer } from "@lib/data/customer"
import { getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import { COLOUR_OPTION, imagesForColour, SIZE_OPTION, variantOption } from "@lib/util/catalog"
import BagView, { LineDetails } from "@modules/bag/bag-view"
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

  const details: Record<string, LineDetails> = {}
  for (const item of cart.items) {
    const product = products.find((p) => p.id === item.product_id)
    const variant = product?.variants?.find((v) => v.id === item.variant_id)
    if (!product || !variant) continue
    const colour = variantOption(product, variant, COLOUR_OPTION)
    details[item.id] = {
      title: product.title ?? undefined,
      size: variantOption(product, variant, SIZE_OPTION),
      colour,
      image: imagesForColour(product, colour)[0],
    }
  }
  return <BagView cart={cart} loggedIn={!!customer} details={details} />
}

// Personal pages: always rendered per request, never pre-built.
export const dynamic = "force-dynamic"
