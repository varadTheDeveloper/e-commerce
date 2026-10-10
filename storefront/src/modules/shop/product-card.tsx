import { Dictionary } from "@lib/i18n"
import { Locale } from "@lib/i18n/config"
import { colourHex, colourName } from "@lib/i18n/colours"
import {
  imagesForColour,
  isProductInStock,
  productColours,
  productPrice,
} from "@lib/util/catalog"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import Price from "./price"

export default function ProductCard({
  product,
  locale,
  t,
  priority = false,
  headingLevel = "h3",
}: {
  product: HttpTypes.StoreProduct
  locale: Locale
  t: Dictionary
  priority?: boolean
  /** h2 on listing pages (under the h1), h3 inside titled rails */
  headingLevel?: "h2" | "h3"
}) {
  const Heading = headingLevel
  const colours = productColours(product)
  const image = imagesForColour(product, colours[0])[0] ?? product.thumbnail
  const price = productPrice(product)
  const inStock = isProductInStock(product)

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="group flex flex-col"
      data-testid="product-card"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-surface">
        {image && (
          <Image
            src={image}
            alt={product.title ?? ""}
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
        {!inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-white/85 py-1.5 text-center text-xs font-semibold text-muted">
            {t.product.outOfStock}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex flex-col gap-1 px-0.5">
        <Heading className="line-clamp-2 text-sm leading-snug text-ink group-hover:text-brand-700" data-testid="product-title">
          {product.title}
        </Heading>
        {price && <Price info={price} t={t} />}
        {colours.length > 1 && (
          <div className="flex items-center gap-1" aria-label={colours.map((c) => colourName(c, locale)).join(", ")}>
            {colours.slice(0, 5).map((c) => (
              <span
                key={c}
                className="h-3.5 w-3.5 rounded-full border border-black/15"
                style={{ backgroundColor: colourHex(c) }}
                title={colourName(c, locale)}
              />
            ))}
          </div>
        )}
      </div>
    </LocalizedClientLink>
  )
}
