import { HttpTypes } from "@medusajs/types"

// Pure helpers for product cards, filters and sorting. No React, no fetching,
// so they are easy to test (catalog.test.ts).

export const SIZE_OPTION = "Size"
export const COLOUR_OPTION = "Colour"

const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"]

/** Sorts sizes the way people expect: XS < S < M, 28 < 30, 2-3Y < 4-5Y. */
export function compareSizes(a: string, b: string): number {
  const ia = LETTER_SIZES.indexOf(a.toUpperCase())
  const ib = LETTER_SIZES.indexOf(b.toUpperCase())
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  const na = parseFloat(a)
  const nb = parseFloat(b)
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb
  return a.localeCompare(b)
}

/** Option value of a variant (e.g. its Size), resolved through the product's option list. */
export function variantOption(
  product: HttpTypes.StoreProduct,
  variant: HttpTypes.StoreProductVariant,
  optionTitle: string
): string | undefined {
  const option = product.options?.find((o) => o.title === optionTitle)
  if (!option) return undefined
  return variant.options?.find((o) => o.option_id === option.id)?.value
}

export function optionValues(
  product: HttpTypes.StoreProduct,
  optionTitle: string
): string[] {
  const option = product.options?.find((o) => o.title === optionTitle)
  const values = option?.values?.map((v) => v.value) ?? []
  return optionTitle === SIZE_OPTION ? [...values].sort(compareSizes) : values
}

export function isVariantInStock(variant: HttpTypes.StoreProductVariant): boolean {
  if (!variant.manage_inventory || variant.allow_backorder) return true
  return (variant.inventory_quantity ?? 0) > 0
}

export type PriceInfo = {
  price: number
  mrp: number
  discountPercent: number
}

export function variantPrice(variant: HttpTypes.StoreProductVariant): PriceInfo | null {
  const cp = variant.calculated_price
  if (!cp || cp.calculated_amount == null) return null
  const price = cp.calculated_amount
  const mrp = Math.max(cp.original_amount ?? price, price)
  const discountPercent = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0
  return { price, mrp, discountPercent }
}

/** Lowest selling price of the product, with its MRP. */
export function productPrice(product: HttpTypes.StoreProduct): PriceInfo | null {
  let best: PriceInfo | null = null
  for (const v of product.variants ?? []) {
    const p = variantPrice(v)
    if (p && (!best || p.price < best.price)) best = p
  }
  return best
}

export function productColours(product: HttpTypes.StoreProduct): string[] {
  return optionValues(product, COLOUR_OPTION)
}

export function productSizes(product: HttpTypes.StoreProduct): string[] {
  return optionValues(product, SIZE_OPTION)
}

/** Sizes that have stock in at least one colour. */
export function availableSizes(product: HttpTypes.StoreProduct): string[] {
  const sizes = new Set<string>()
  for (const v of product.variants ?? []) {
    const size = variantOption(product, v, SIZE_OPTION)
    if (size && isVariantInStock(v)) sizes.add(size)
  }
  return [...sizes].sort(compareSizes)
}

export function isProductInStock(product: HttpTypes.StoreProduct): boolean {
  return (product.variants ?? []).some(isVariantInStock)
}

export function productFabric(product: HttpTypes.StoreProduct): string | undefined {
  const fabric = product.metadata?.fabric
  return typeof fabric === "string" ? fabric : undefined
}

/**
 * Images for one colour, in this order of preference:
 * 1. images tagged with that colour (image metadata "colour", set by the seed),
 * 2. images the admin attached to that colour's variants,
 * 3. file names ending "-<colour>.<ext>" / "-<colour>-<n>.<ext>",
 * 4. otherwise every product image.
 */
export function imagesForColour(
  product: HttpTypes.StoreProduct,
  colour?: string
): string[] {
  const images = product.images ?? []
  const all = images.map((i) => i.url).filter(Boolean)
  if (!all.length) return product.thumbnail ? [product.thumbnail] : []
  if (!colour) return all

  const tagged = images.filter((i) => i.metadata?.colour === colour).map((i) => i.url)
  if (tagged.length) return tagged

  const variantUrls = (product.variants ?? [])
    .filter((v) => variantOption(product, v, COLOUR_OPTION) === colour)
    .flatMap((v) => v.images ?? [])
    .map((i) => i.url)
  if (variantUrls.length) return [...new Set(variantUrls)]

  const named = all.filter((url) => new RegExp(`-${colour}(-[a-z0-9]+)?\\.[a-z]+$`, "i").test(url))
  return named.length ? named : all
}

/** Alt text saved with a picture, if any. */
export function imageAlt(product: HttpTypes.StoreProduct, url: string): string | undefined {
  const alt = product.images?.find((i) => i.url === url)?.metadata?.alt
  return typeof alt === "string" ? alt : undefined
}

// ----- Filters -----

export const PRICE_BUCKETS = [
  { key: "0-499", min: 0, max: 499 },
  { key: "500-999", min: 500, max: 999 },
  { key: "1000-1499", min: 1000, max: 1499 },
  { key: "1500-1999", min: 1500, max: 1999 },
  { key: "2000-", min: 2000, max: Infinity },
] as const

export type SortKey = "newest" | "price-asc" | "price-desc" | "discount"
export const SORT_KEYS: SortKey[] = ["newest", "price-asc", "price-desc", "discount"]

export type Filters = {
  size: string[]
  colour: string[]
  price: string[]
  fabric: string[]
}

export const EMPTY_FILTERS: Filters = { size: [], colour: [], price: [], fabric: [] }

type SearchParams = Record<string, string | string[] | undefined>

function list(value: string | string[] | undefined): string[] {
  if (!value) return []
  return (Array.isArray(value) ? value : value.split(","))
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean)
}

export function parseFilters(params: SearchParams): Filters {
  return {
    size: list(params.size),
    colour: list(params.colour),
    price: list(params.price).filter((p) => PRICE_BUCKETS.some((b) => b.key === p)),
    fabric: list(params.fabric),
  }
}

export function parseSort(params: SearchParams): SortKey {
  const sort = Array.isArray(params.sort) ? params.sort[0] : params.sort
  return SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : "newest"
}

export function filtersToQuery(
  filters: Filters,
  sort: SortKey,
  keep: Record<string, string> = {}
): string {
  const q = new URLSearchParams(keep)
  for (const key of ["size", "colour", "price", "fabric"] as const) {
    if (filters[key].length) q.set(key, filters[key].join(","))
  }
  if (sort !== "newest") q.set("sort", sort)
  const s = q.toString()
  return s ? `?${s}` : ""
}

export function activeFilterCount(filters: Filters): number {
  return filters.size.length + filters.colour.length + filters.price.length + filters.fabric.length
}

function inBucket(price: number, key: string): boolean {
  const b = PRICE_BUCKETS.find((x) => x.key === key)
  return !!b && price >= b.min && price <= b.max
}

/** A product matches when every active filter group matches (values inside a group are OR). */
export function matchesFilters(product: HttpTypes.StoreProduct, f: Filters): boolean {
  if (f.size.length && !availableSizes(product).some((s) => f.size.includes(s))) return false
  if (f.colour.length && !productColours(product).some((c) => f.colour.includes(c))) return false
  if (f.fabric.length) {
    const fabric = productFabric(product)
    if (!fabric || !f.fabric.includes(fabric)) return false
  }
  if (f.price.length) {
    const p = productPrice(product)
    if (!p || !f.price.some((key) => inBucket(p.price, key))) return false
  }
  return true
}

export function sortProducts(
  products: HttpTypes.StoreProduct[],
  sort: SortKey
): HttpTypes.StoreProduct[] {
  const price = (p: HttpTypes.StoreProduct) => productPrice(p)?.price ?? Infinity
  const discount = (p: HttpTypes.StoreProduct) => productPrice(p)?.discountPercent ?? 0
  const created = (p: HttpTypes.StoreProduct) => new Date(p.created_at ?? 0).getTime()
  const sorted = [...products]
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => price(a) - price(b))
    case "price-desc":
      return sorted.sort((a, b) => price(b) - price(a))
    case "discount":
      return sorted.sort((a, b) => discount(b) - discount(a))
    default:
      return sorted.sort((a, b) => created(b) - created(a))
  }
}

export type Facets = {
  size: { value: string; count: number }[]
  colour: { value: string; count: number }[]
  price: { value: string; count: number }[]
  fabric: { value: string; count: number }[]
}

/** Filter choices with product counts, built from the unfiltered list. */
export function buildFacets(products: HttpTypes.StoreProduct[]): Facets {
  const count = (values: string[]) => {
    const m = new Map<string, number>()
    values.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1))
    return m
  }
  const sizes = count(products.flatMap(availableSizes))
  const colours = count(products.flatMap(productColours))
  const fabrics = count(products.map(productFabric).filter((f): f is string => !!f))
  const prices = count(
    products.flatMap((p) => {
      const price = productPrice(p)?.price
      return price == null ? [] : PRICE_BUCKETS.filter((b) => inBucket(price, b.key)).map((b) => b.key)
    })
  )
  const toList = (m: Map<string, number>) =>
    [...m.entries()].map(([value, count]) => ({ value, count }))
  return {
    size: toList(sizes).sort((a, b) => compareSizes(a.value, b.value)),
    colour: toList(colours),
    price: PRICE_BUCKETS.filter((b) => prices.has(b.key)).map((b) => ({ value: b.key, count: prices.get(b.key)! })),
    fabric: toList(fabrics),
  }
}

/**
 * Medusa gives a product one collection; the catalogue also lists extra
 * collection handles in metadata.collections. Either one counts.
 */
export function inCollection(product: HttpTypes.StoreProduct, handle: string): boolean {
  const extra = product.metadata?.collections
  return (
    product.collection?.handle === handle ||
    (Array.isArray(extra) && extra.includes(handle))
  )
}
