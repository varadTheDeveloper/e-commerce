import { HttpTypes } from "@medusajs/types"
import type { LineDetails } from "@modules/bag/bag-view"
import { COLOUR_OPTION, imagesForColour, SIZE_OPTION, variantOption } from "./catalog"

/**
 * Name, size, colour and picture of each bag or order line, looked up in the
 * catalogue (already in the page language). Lines whose product is gone keep
 * the name stored on the line.
 */
export function lineDetails(
  items: { id: string; product_id?: string | null; variant_id?: string | null }[],
  products: HttpTypes.StoreProduct[]
): Record<string, LineDetails> {
  const details: Record<string, LineDetails> = {}
  for (const item of items) {
    const product = products.find((p) => p.id === item.product_id)
    const variant = product?.variants?.find((v) => v.id === item.variant_id)
    if (!product || !variant) continue
    const colour = variantOption(product, variant, COLOUR_OPTION)
    details[item.id] = {
      title: product.title ?? undefined,
      size: variantOption(product, variant, SIZE_OPTION),
      colour,
      image: imagesForColour(product, colour)[0],
    }
  }
  return details
}
