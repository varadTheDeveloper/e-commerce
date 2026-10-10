import { Dictionary, format } from "@lib/i18n"
import { Locale } from "@lib/i18n/config"
import {
  activeFilterCount,
  buildFacets,
  matchesFilters,
  parseFilters,
  parseSort,
  sortProducts,
} from "@lib/util/catalog"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ChevronRightIcon } from "@modules/common/icons/ui"
import ListingFilters, { SortSelect } from "./filters"
import ProductGrid from "./product-grid"

const PAGE_SIZE = 24

export type Crumb = { label: string; href?: string }

/** Shared page body for categories, collections, all products and search. */
export default function Listing({
  title,
  path,
  crumbs,
  products,
  searchParams,
  locale,
  t,
  subcategories = [],
}: {
  title: string
  /** This page's address without the language, e.g. /categories/men */
  path: string
  crumbs: Crumb[]
  products: HttpTypes.StoreProduct[]
  searchParams: Record<string, string | string[] | undefined>
  locale: Locale
  t: Dictionary
  subcategories?: { handle: string; name: string }[]
}) {
  const filters = parseFilters(searchParams)
  const sort = parseSort(searchParams)
  const page = Math.max(1, parseInt(String(searchParams.page ?? "1"), 10) || 1)

  const keep = typeof searchParams.q === "string" ? { q: searchParams.q } : undefined
  const facets = buildFacets(products)
  const matching = sortProducts(products.filter((p) => matchesFilters(p, filters)), sort)
  const shown = matching.slice(0, page * PAGE_SIZE)

  const moreParams = new URLSearchParams()
  Object.entries(searchParams).forEach(([k, v]) => {
    if (k !== "page" && typeof v === "string") moreParams.set(k, v)
  })
  moreParams.set("page", String(page + 1))

  return (
    <div className="content-container py-5 small:py-10">
      <nav aria-label="Breadcrumb" className="mb-2 text-[13px] text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {crumbs.map((c, i) => (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRightIcon size={14} />}
              {c.href ? (
                <LocalizedClientLink href={c.href} className="hover:text-ink">
                  {c.label}
                </LocalizedClientLink>
              ) : (
                <span aria-current="page" className="text-ink">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <h1 className="heading-lg" data-testid="listing-title">
          {title}{" "}
          <span className="font-sans text-sm text-muted" data-testid="result-count">
            {matching.length === 1 ? t.listing.resultsOne : format(t.listing.results, { count: matching.length })}
          </span>
        </h1>
        <SortSelect sort={sort} filters={filters} keep={keep} />
      </div>

      {subcategories.length > 0 && (
        <ul className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 small:mx-0 small:px-0">
          {subcategories.map((s) => (
            <li key={s.handle} className="shrink-0">
              <LocalizedClientLink href={`/categories/${s.handle}`} className="chip h-9 text-[13px]">
                {s.name}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      )}

      <div className="small:grid small:grid-cols-[220px_1fr] small:gap-10">
        <ListingFilters facets={facets} filters={filters} sort={sort} total={matching.length} keep={keep} />
        <div>
          {shown.length > 0 ? (
            <ProductGrid products={shown} locale={locale} t={t} />
          ) : (
            <div className="flex flex-col items-center gap-4 bg-surface px-6 py-16 text-center">
              <p className="text-muted">{t.listing.noResults}</p>
              {activeFilterCount(filters) > 0 && (
                <LocalizedClientLink href={path} className="btn-outline">
                  {t.listing.clearFilters}
                </LocalizedClientLink>
              )}
            </div>
          )}
          {matching.length > shown.length && (
            <div className="mt-8 flex justify-center">
              <a href={`?${moreParams.toString()}`} className="btn-outline px-12">
                {t.listing.loadMore}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
