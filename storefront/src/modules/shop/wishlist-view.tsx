"use client"

import { listProductsFor } from "@lib/data/catalog"
import { useI18n } from "@lib/i18n/provider"
import { useWishlist } from "@lib/wishlist"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useEffect, useState } from "react"
import ProductCardClient from "./product-card-client"

/** Saved products, read from this browser's wishlist. */
export default function WishlistView() {
  const { locale, t } = useI18n()
  const { handles, inAccount } = useWishlist()
  const [products, setProducts] = useState<HttpTypes.StoreProduct[] | null>(null)

  useEffect(() => {
    let alive = true
    listProductsFor(locale)
      .then((all) => alive && setProducts(all))
      .catch(() => alive && setProducts([]))
    return () => {
      alive = false
    }
  }, [locale])

  const saved = (products ?? [])
    .filter((p) => p.handle && handles.includes(p.handle))
    .sort((a, b) => handles.indexOf(a.handle!) - handles.indexOf(b.handle!))

  if (products === null) {
    return <p className="py-16 text-center text-muted">{t.common.loading}</p>
  }
  if (!saved.length) {
    return (
      <div className="flex flex-col items-center gap-5 bg-surface px-6 py-16 text-center">
        <p className="max-w-sm text-muted">{t.wishlist.empty}</p>
        <LocalizedClientLink href="/store" className="btn-primary px-10">
          {t.common.shopAll}
        </LocalizedClientLink>
      </div>
    )
  }
  return (
    <>
      {!inAccount && <p className="mb-6 text-sm text-muted">{t.wishlist.note}</p>}
      <ul className="grid grid-cols-2 gap-x-2 gap-y-8 small:grid-cols-3 small:gap-x-4 medium:grid-cols-4" data-testid="wishlist-items">
        {saved.map((p) => (
          <li key={p.id}>
            <ProductCardClient product={p} />
          </li>
        ))}
      </ul>
    </>
  )
}
