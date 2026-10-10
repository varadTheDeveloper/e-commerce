import { HttpTypes } from "@medusajs/types"
import { COLOURS } from "@lib/i18n/colours"
import { productColours, productFabric } from "./catalog"

// Simple in-memory product search, good for a catalogue of a few hundred items.
// Every word typed must match a word of the product (in the page language or
// English), allowing plurals ("kurtas") and one typo in longer words ("krta" no, "kurtha" yes).

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // Latin accents only; Devanagari marks are kept
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
}

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

function wordMatches(query: string, word: string): boolean {
  if (word.startsWith(query) || (query.startsWith(word) && word.length >= 3)) return true
  return query.length >= 4 && withinOneEdit(query, word)
}

function haystack(product: HttpTypes.StoreProduct): string[] {
  const colourWords = productColours(product).flatMap((c) => [c, ...Object.values(COLOURS[c]?.name ?? {})])
  const parts = [
    product.title,
    product.description,
    product.material,
    productFabric(product),
    ...(product.categories ?? []).map((c) => c.name),
    ...colourWords,
  ]
  return normalize(parts.filter(Boolean).join(" ")).split(" ")
}

/**
 * Products (in the page language) matching the query. `alsoMatch` is the same
 * catalogue in another language; a product matches if either version does.
 */
export function searchProducts(
  products: HttpTypes.StoreProduct[],
  query: string,
  alsoMatch?: HttpTypes.StoreProduct[]
): HttpTypes.StoreProduct[] {
  const terms = normalize(query).split(" ").filter(Boolean)
  if (!terms.length) return []
  const other = new Map((alsoMatch ?? []).map((p) => [p.id, haystack(p)]))

  const scored = products
    .map((p) => {
      const words = [...haystack(p), ...(other.get(p.id) ?? [])]
      const title = normalize(p.title ?? "")
      const ok = terms.every((term) => words.some((w) => wordMatches(term, w)))
      const score = terms.filter((term) => title.includes(term)).length
      return { p, ok, score }
    })
    .filter((x) => x.ok)

  return scored.sort((a, b) => b.score - a.score).map((x) => x.p)
}
