import { getDictionary } from "@lib/i18n"
import WishlistView from "@modules/shop/wishlist-view"
import { Metadata } from "next"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: t.wishlist.title, robots: { index: false } }
}

export default async function WishlistPage(props: Props) {
  const t = getDictionary((await props.params).locale)
  return (
    <div className="content-container py-6 small:py-10">
      <h1 className="heading-lg mb-2">{t.wishlist.title}</h1>
      <WishlistView />
    </div>
  )
}
