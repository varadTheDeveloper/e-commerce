import { Dictionary } from "@lib/i18n"
import { Locale } from "@lib/i18n/config"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ChevronRightIcon } from "@modules/common/icons/ui"
import ProductCard from "./product-card"

/** Horizontal, swipeable row of products with a "View all" link. */
export default function ProductRail({
  title,
  href,
  products,
  locale,
  t,
  priority = false,
}: {
  priority?: boolean
  title: string
  href?: string
  products: HttpTypes.StoreProduct[]
  locale: Locale
  t: Dictionary
}) {
  if (!products.length) return null
  return (
    <section className="content-container py-8">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-xl font-semibold small:text-2xl">{title}</h2>
        {href && (
          <LocalizedClientLink href={href} className="flex items-center text-sm font-semibold text-brand-600 hover:text-brand-700">
            {t.common.viewAll}
            <ChevronRightIcon size={16} />
          </LocalizedClientLink>
        )}
      </div>
      <ul className="no-scrollbar -mx-4 flex scroll-px-4 snap-x snap-mandatory gap-3 overflow-x-auto px-4 small:mx-0 small:grid small:grid-cols-4 small:gap-4 small:overflow-visible small:px-0">
        {products.slice(0, 8).map((p, i) => (
          <li key={p.id} className="w-[44%] shrink-0 snap-start small:w-auto">
            <ProductCard product={p} locale={locale} t={t} priority={priority && i < 2} />
          </li>
        ))}
      </ul>
    </section>
  )
}
