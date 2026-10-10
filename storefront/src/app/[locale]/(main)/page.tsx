import { BANNERS } from "@config/banners"
import { BRAND } from "@config/brand"
import { listCategoryTree, listProductsFor } from "@lib/data/catalog"
import { getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import { imagesForColour, inCollection, productColours } from "@lib/util/catalog"
import CategoryTiles from "@modules/home/components/category-tiles"
import FestiveBand from "@modules/home/components/festive-band"
import Hero from "@modules/home/components/hero"
import TrustStrip from "@modules/home/components/trust-strip"
import ProductRail from "@modules/shop/product-rail"
import { HttpTypes } from "@medusajs/types"
import { Metadata } from "next"

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: { absolute: `${BRAND.name} | ${t.home.heroTitle}` }, description: t.footer.about }
}

const firstImage = (p?: HttpTypes.StoreProduct) => (p ? imagesForColour(p, productColours(p)[0])[0] : undefined)

export default async function Home(props: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await props.params).locale)
  const t = getDictionary(locale)
  const [products, categories] = await Promise.all([
    listProductsFor(locale).catch(() => []),
    listCategoryTree(locale).catch(() => []),
  ])

  const newArrivals = products.filter((p) => inCollection(p, "new-arrivals"))
  const festive = products.filter((p) => inCollection(p, "festive"))

  const parents = categories.filter((c) => !c.parent_category_id)
  const tiles = parents.flatMap((parent) =>
    categories
      .filter((c) => c.parent_category_id === parent.id)
      .map((c) => ({
        handle: c.handle,
        name: c.name,
        group: parent.name,
        image: firstImage(products.find((p) => p.categories?.some((pc) => pc.id === c.id))),
      }))
  )

  return (
    <>
      <Hero t={t} women={BANNERS.women} men={BANNERS.men} />
      <TrustStrip t={t} />
      <ProductRail priority title={t.home.newArrivals} href="/collections/new-arrivals" products={newArrivals} locale={locale} t={t} />
      <CategoryTiles title={t.home.shopByCategory} tiles={tiles} />
      <FestiveBand t={t} banner={BANNERS.festive} />
      <ProductRail title={t.home.festivePicks} href="/collections/festive" products={festive} locale={locale} t={t} />
    </>
  )
}
