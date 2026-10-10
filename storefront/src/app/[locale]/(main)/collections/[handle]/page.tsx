import { getCollection, listProductsFor } from "@lib/data/catalog"
import { getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import { inCollection } from "@lib/util/catalog"
import Listing from "@modules/shop/listing"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ locale: string; handle: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, handle } = await props.params
  const collection = await getCollection(toLocale(locale), handle)
  return collection
    ? { title: collection.title, description: `${collection.title} – ${getDictionary(locale).footer.about}` }
    : {}
}

export default async function CollectionPage(props: Props) {
  const { locale: raw, handle } = await props.params
  const locale = toLocale(raw)
  const collection = await getCollection(locale, handle)
  if (!collection) notFound()
  const t = getDictionary(locale)

  const all = await listProductsFor(locale)
  const products = all.filter((p) => p.collection_id === collection.id || inCollection(p, handle))

  return (
    <Listing
      title={collection.title}
      path={`/collections/${handle}`}
      crumbs={[{ label: t.common.home, href: "/" }, { label: collection.title }]}
      products={products}
      searchParams={await props.searchParams}
      locale={locale}
      t={t}
    />
  )
}
