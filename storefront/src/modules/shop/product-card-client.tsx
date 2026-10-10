"use client"

import { useI18n } from "@lib/i18n/provider"
import { HttpTypes } from "@medusajs/types"
import ProductCard from "./product-card"

/** The same product card, for client-rendered lists (e.g. the wishlist). */
export default function ProductCardClient({ product }: { product: HttpTypes.StoreProduct }) {
  const { locale, t } = useI18n()
  return <ProductCard product={product} locale={locale} t={t} />
}
