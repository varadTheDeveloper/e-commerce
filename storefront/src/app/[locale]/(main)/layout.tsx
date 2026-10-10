import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getDictionary } from "@lib/i18n"
import BottomNav from "@modules/layout/components/header/bottom-nav"
import { bagCount } from "@modules/layout/components/header/bag-link"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import Footer from "@modules/layout/templates/footer"
import Header, { navCategories } from "@modules/layout/templates/header"

export default async function PageLayout(props: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await props.params
  const t = getDictionary(locale)
  const [customer, cart, categories, count] = await Promise.all([
    retrieveCustomer(),
    retrieveCart(),
    navCategories(locale),
    bagCount(),
  ])

  return (
    <>
      <Header locale={locale} t={t} />
      {customer && cart && <CartMismatchBanner customer={customer} cart={cart} />}
      <main id="main" className="min-h-[60vh]">
        {props.children}
      </main>
      <Footer t={t} categories={categories} />
      <BottomNav bagCount={count} />
    </>
  )
}
