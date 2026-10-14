"use server"

import { sdk } from "@lib/config"
import { localeHeader } from "@lib/i18n/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"
import { getRegion } from "./regions"

// Catalogue reads for the shop pages. The language is always passed in
// explicitly (from the URL), so statically built pages get the right text.

const PRODUCT_FIELDS = [
  "id",
  "title",
  "handle",
  "description",
  "thumbnail",
  "material",
  "created_at",
  "collection_id",
  "+metadata",
  "*images",
  "*categories",
  "*options",
  "*options.values",
  "*variants.options",
  "*variants.calculated_price",
  "+variants.inventory_quantity",
  "+variants.manage_inventory",
  "+variants.allow_backorder",
  "*variants.images",
].join(",")

/** Shop catalogue is small (hundreds of products), so pages load it whole and filter in memory. */
const MAX_PRODUCTS = 500

/**
 * Catalogue data is cached, then fetched again at most every 5 minutes, so changes made in the
 * admin (prices, new products, photos) reach the website without a new deploy. The bag and
 * checkout always use the backend's live prices and stock.
 */
const CATALOG_REVALIDATE_SECONDS = 300

async function cacheOptions(tag: string) {
  return { ...(await getCacheOptions(tag)), revalidate: CATALOG_REVALIDATE_SECONDS }
}

export async function listCategoryTree(locale: string) {
  const { product_categories } = await sdk.client.fetch<{
    product_categories: HttpTypes.StoreProductCategory[]
  }>("/store/product-categories", {
    query: {
      fields: "id,name,handle,rank,parent_category_id,*category_children",
      limit: 200,
    },
    headers: localeHeader(locale),
    next: await cacheOptions("categories"),
    cache: "force-cache",
  })
  return product_categories.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
}

export async function getCategory(locale: string, handle: string) {
  const { product_categories } = await sdk.client.fetch<{
    product_categories: HttpTypes.StoreProductCategory[]
  }>("/store/product-categories", {
    query: {
      handle,
      fields: "id,name,handle,parent_category_id,*parent_category,*category_children",
    },
    headers: localeHeader(locale),
    next: await cacheOptions("categories"),
    cache: "force-cache",
  })
  return product_categories[0] ?? null
}

export async function getCollection(locale: string, handle: string) {
  const { collections } = await sdk.client.fetch<{
    collections: HttpTypes.StoreCollection[]
  }>("/store/collections", {
    query: { handle, fields: "id,title,handle" },
    headers: localeHeader(locale),
    next: await cacheOptions("collections"),
    cache: "force-cache",
  })
  return collections[0] ?? null
}

export async function listProductsFor(
  locale: string,
  filter: { category_id?: string[]; collection_id?: string[]; handle?: string } = {}
): Promise<HttpTypes.StoreProduct[]> {
  const region = await getRegion()
  if (!region) {
    return []
  }
  const { products } = await sdk.client.fetch<{
    products: HttpTypes.StoreProduct[]
  }>("/store/products", {
    query: {
      ...filter,
      region_id: region.id,
      fields: PRODUCT_FIELDS,
      limit: MAX_PRODUCTS,
      order: "-created_at",
    },
    headers: localeHeader(locale),
    next: await cacheOptions("products"),
    cache: "force-cache",
  })
  return products
}

export async function getProduct(locale: string, handle: string) {
  const [product] = await listProductsFor(locale, { handle })
  return product ?? null
}
