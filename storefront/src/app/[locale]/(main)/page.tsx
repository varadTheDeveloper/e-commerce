import { BRAND } from "@config/brand"
import { listCategoryTree, listProductsFor } from "@lib/data/catalog"
import { getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import { imagesForColour, inCollection, productColours } from "@lib/util/catalog"
import CategoryTiles from "@modules/home/components/category-tiles"
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

/** First picture, preferring a colourful variant over white for banners and tiles. */
const firstImage = (p?: HttpTypes.StoreProduct) => {
  if (!p) return undefined
  const colours = productColours(p)
  return imagesForColour(p, colours.find((c) => c !== "white") ?? colours[0])[0]
}

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
      <Hero
        t={t}
        heroImages={newArrivals.slice(0, 2).map(firstImage).filter((x): x is string => !!x)}
        festiveImages={festive.slice(0, 2).map(firstImage).filter((x): x is string => !!x)}
      />
      <TrustStrip t={t} />
      <CategoryTiles title={t.home.shopByCategory} tiles={tiles} />
      <ProductRail priority title={t.home.newArrivals} href="/collections/new-arrivals" products={newArrivals} locale={locale} t={t} />
      <ProductRail title={t.home.festivePicks} href="/collections/festive" products={festive} locale={locale} t={t} />
    </>
  )
}
