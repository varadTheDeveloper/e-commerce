import { retrieveCart } from "@lib/data/cart"
import { listProductsFor } from "@lib/data/catalog"
import { getShopSettings } from "@lib/data/checkout"
import { getDeliveryEstimate } from "@lib/data/delivery"
import { retrieveCustomer } from "@lib/data/customer"
import { getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import { lineDetails } from "@lib/util/line-details"
import { CHECKOUT_CART_FIELDS } from "@lib/util/checkout"
import CheckoutView from "@modules/checkout/checkout-view"
import { Metadata } from "next"
import { redirect } from "next/navigation"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: t.checkout.title, robots: { index: false } }
}

export default async function Checkout(props: Props) {
  const locale = toLocale((await props.params).locale)
  const [cart, customer, settings, products] = await Promise.all([
    retrieveCart(undefined, CHECKOUT_CART_FIELDS).catch(() => null),
    retrieveCustomer().catch(() => null),
    getShopSettings().catch(() => null),
    listProductsFor(locale).catch(() => []),
  ])
  if (!cart?.items?.length) redirect(`/${locale}/cart`)

  const details = lineDetails(cart.items, products)
  const pincode = cart.shipping_address?.postal_code
  const estimate = pincode ? await getDeliveryEstimate(pincode) : null

  return <CheckoutView cart={cart} customer={customer} settings={settings} details={details} estimate={estimate} />
}
