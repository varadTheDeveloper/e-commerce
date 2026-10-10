import { getCategory, listCategoryTree, listProductsFor } from "@lib/data/catalog"
import { getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import Listing from "@modules/shop/listing"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ locale: string; category: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Category handles are unique, so /categories/men-shirts is enough;
// the last part of a longer address is used.
async function load(props: Props) {
  const { locale: raw, category } = await props.params
  const locale = toLocale(raw)
  const handle = category[category.length - 1]
  const cat = await getCategory(locale, handle)
  return { locale, cat }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { cat, locale } = await load(props)
  return cat ? { title: cat.name, description: `${cat.name} – ${getDictionary(locale).footer.about}` } : {}
}

export default async function CategoryPage(props: Props) {
  const { locale, cat } = await load(props)
  if (!cat) notFound()
  const t = getDictionary(locale)

  // A parent category shows its own products and those of its children.
  const tree = await listCategoryTree(locale)
  const children = tree.filter((c) => c.parent_category_id === cat.id)
  const ids = [cat.id, ...children.map((c) => c.id)]
  const products = await listProductsFor(locale, { category_id: ids })

  const parent = cat.parent_category_id ? tree.find((c) => c.id === cat.parent_category_id) : undefined
  const crumbs = [
    { label: t.common.home, href: "/" },
    ...(parent ? [{ label: parent.name, href: `/categories/${parent.handle}` }] : []),
    { label: cat.name },
  ]

  return (
    <Listing
      title={cat.name}
      path={`/categories/${cat.handle}`}
      crumbs={crumbs}
      products={products}
      subcategories={children.map((c) => ({ handle: c.handle, name: c.name }))}
      searchParams={await props.searchParams}
      locale={locale}
      t={t}
    />
  )
}
