import { Dictionary } from "@lib/i18n"
import { Locale } from "@lib/i18n/config"
import { HttpTypes } from "@medusajs/types"
import ProductCard from "./product-card"

export default function ProductGrid({
  products,
  locale,
  t,
}: {
  products: HttpTypes.StoreProduct[]
  locale: Locale
  t: Dictionary
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 small:grid-cols-3 medium:grid-cols-4" data-testid="products-list">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} locale={locale} t={t} priority={i < 4} headingLevel="h2" />
        </li>
      ))}
    </ul>
  )
}
