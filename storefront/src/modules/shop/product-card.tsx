import { Dictionary } from "@lib/i18n"
import { Locale } from "@lib/i18n/config"
import { colourHex, colourName } from "@lib/i18n/colours"
import {
  imageAlt,
  imagesForColour,
  inCollection,
  isProductInStock,
  productColours,
  productPrice,
} from "@lib/util/catalog"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import Price from "./price"
import WishlistButton from "./wishlist-button"

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
  const [image, hoverImage] = imagesForColour(product, colours[0])
  const price = productPrice(product)
  const inStock = isProductInStock(product)
  const badge =
    product.metadata?.badge === "bestseller"
      ? t.home2.bestseller
      : inCollection(product, "new-arrivals")
      ? t.home2.newBadge
      : null

  return (
    <div className="group relative flex flex-col" data-testid="product-card">
      <LocalizedClientLink href={`/products/${product.handle}`} className="flex flex-col">
        <div className="relative aspect-[4/5] overflow-hidden bg-surface">
          {image && (
            <Image
              src={image}
              alt={imageAlt(product, image) ?? product.title ?? ""}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-opacity duration-500"
            />
          )}
          {hoverImage && (
            <Image
              src={hoverImage}
              alt=""
              fill
              sizes="(max-width: 1024px) 33vw, 25vw"
              className="hidden object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 small:block"
            />
          )}
          {badge && (
            <span className="absolute left-0 top-3 bg-white px-2.5 py-1 text-[11px] font-medium tracking-wide text-ink">
              {badge}
            </span>
          )}
          {!inStock && (
            <span className="absolute inset-x-0 bottom-0 bg-white/90 py-2 text-center text-xs font-medium text-muted">
              {t.product.outOfStock}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <Heading className="line-clamp-1 text-[14px] text-ink small:text-[15px]" data-testid="product-title">
            {product.title}
          </Heading>
          {price && <Price info={price} t={t} />}
          {colours.length > 1 && (
            <div className="mt-0.5 flex items-center gap-1.5" aria-label={colours.map((c) => colourName(c, locale)).join(", ")}>
              {colours.slice(0, 5).map((c) => (
                <span
                  key={c}
                  className="h-3 w-3 rounded-full ring-1 ring-black/15"
                  style={{ backgroundColor: colourHex(c) }}
                  title={colourName(c, locale)}
                />
              ))}
            </div>
          )}
        </div>
      </LocalizedClientLink>
      <WishlistButton handle={product.handle!} />
    </div>
  )
}
