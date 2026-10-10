import { listProductsFor } from "@lib/data/catalog"
import { getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import { searchProducts } from "@lib/util/search"
import SearchBox from "@modules/layout/components/header/search-box"
import Listing from "@modules/shop/listing"
import { Metadata } from "next"

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: t.common.search, robots: { index: false } }
}

export default async function SearchPage(props: Props) {
  const locale = toLocale((await props.params).locale)
  const t = getDictionary(locale)
  const searchParams = await props.searchParams
  const q = (Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q ?? "").trim().slice(0, 100)

  if (!q) {
    return (
      <div className="content-container py-6">
        <SearchBox locale={locale} t={t} id="search-page" />
      </div>
    )
  }

  // Match against the text in the page language and in English, so "kurta"
  // finds कुर्ता on the Marathi site too.
  const [local, english] = await Promise.all([
    listProductsFor(locale),
    locale === "en" ? Promise.resolve(null) : listProductsFor("en"),
  ])
  const products = searchProducts(local, q, english ?? undefined)

  return (
    <Listing
      title={`“${q}”`}
      path={`/search?q=${encodeURIComponent(q)}`}
      crumbs={[{ label: t.common.home, href: "/" }, { label: t.common.search }]}
      products={products}
      searchParams={searchParams}
      locale={locale}
      t={t}
    />
  )
}
