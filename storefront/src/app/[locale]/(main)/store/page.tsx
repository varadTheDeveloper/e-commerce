import { listProductsFor } from "@lib/data/catalog"
import { getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import Listing from "@modules/shop/listing"
import { Metadata } from "next"

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: t.common.shopAll, description: t.footer.about }
}

export default async function StorePage(props: Props) {
  const locale = toLocale((await props.params).locale)
  const t = getDictionary(locale)
  const products = await listProductsFor(locale)

  return (
    <Listing
      title={t.common.shopAll}
      path="/store"
      crumbs={[{ label: t.common.home, href: "/" }, { label: t.common.shopAll }]}
      products={products}
      searchParams={await props.searchParams}
      locale={locale}
      t={t}
    />
  )
}
