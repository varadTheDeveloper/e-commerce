"use client"

import { addToCart } from "@lib/data/cart"
import { format } from "@lib/i18n"
import { colourHex, colourName } from "@lib/i18n/colours"
import { useI18n } from "@lib/i18n/provider"
import {
  COLOUR_OPTION,
  compareSizes,
  imagesForColour,
  isVariantInStock,
  productColours,
  productPrice,
  productSizes,
  SIZE_OPTION,
  variantOption,
  variantPrice,
} from "@lib/util/catalog"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { BagIcon, CheckIcon } from "@modules/common/icons/ui"
import { useMemo, useRef, useState, useTransition } from "react"
import Price from "../price"
import Gallery from "./gallery"
import PincodeCheck from "./pincode"
import SizeChartButton from "./size-chart"

const LOW_STOCK = 5

export default function ProductView({
  product,
  details,
}: {
  product: HttpTypes.StoreProduct
  /** Server-rendered details block, shown under the buttons */
  details: React.ReactNode
}) {
  const { locale, t } = useI18n()
  const colours = productColours(product)
  const sizes = productSizes(product)

  const variantFor = (colour?: string, size?: string) =>
    product.variants?.find(
      (v) =>
        (!colour || variantOption(product, v, COLOUR_OPTION) === colour) &&
        (!size || variantOption(product, v, SIZE_OPTION) === size)
    )

  // Start on the first colour that has any stock
  const firstInStock =
    colours.find((c) => product.variants?.some((v) => variantOption(product, v, COLOUR_OPTION) === c && isVariantInStock(v))) ??
    colours[0]

  const [colour, setColour] = useState<string | undefined>(firstInStock)
  const [size, setSize] = useState<string | undefined>(sizes.length === 1 ? sizes[0] : undefined)
  const [sizeError, setSizeError] = useState(false)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, startAdding] = useTransition()
  const sizesRef = useRef<HTMLFieldSetElement>(null)

  const images = useMemo(() => imagesForColour(product, colour), [product, colour])
  const variant = size ? variantFor(colour, size) : undefined
  const price = (variant && variantPrice(variant)) || productPrice(product)
  const stock = variant?.manage_inventory ? variant.inventory_quantity ?? 0 : undefined
  const canBuy = !!variant && isVariantInStock(variant)

  const onAdd = () => {
    setError(null)
    if (!size || !variant) {
      setSizeError(true)
      sizesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    startAdding(async () => {
      try {
        await addToCart({ variantId: variant.id, quantity: 1, locale })
        setAdded(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const addLabel = adding ? t.product.adding : added ? t.product.added : t.product.addToBag
  const soldOut = !!variant && !canBuy

  return (
    <div className="small:grid small:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] small:gap-10">
      <div className="small:sticky small:top-32 small:self-start">
        <Gallery images={images} alt={product.title ?? ""} />
      </div>

      <div className="mt-4 flex flex-col gap-5 small:mt-0">
        <div>
          <h1 className="text-xl font-semibold leading-snug small:text-2xl" data-testid="pdp-title">
            {product.title}
          </h1>
          {price && (
            <div className="mt-2">
              <Price info={price} t={t} size="lg" />
              <p className="mt-0.5 text-xs text-muted">{t.product.inclTaxes}</p>
            </div>
          )}
        </div>

        {colours.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              {format(t.product.selectColour, { colour: colour ? colourName(colour, locale) : "" })}
            </legend>
            <div className="flex flex-wrap gap-2.5">
              {colours.map((c) => {
                const thumb = imagesForColour(product, c)[0]
                const on = c === colour
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColour(c)
                      setAdded(false)
                    }}
                    aria-pressed={on}
                    aria-label={colourName(c, locale)}
                    title={colourName(c, locale)}
                    className={`relative h-16 w-[52px] overflow-hidden rounded-lg border-2 ${on ? "border-brand-600" : "border-line hover:border-muted"}`}
                    style={{ backgroundColor: colourHex(c) }}
                    data-testid={`colour-${c}`}
                  >
                    {thumb && (
                      // Small decorative preview; next/image is not needed at this size
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {sizes.length > 0 && (
          <fieldset ref={sizesRef}>
            <div className="mb-2 flex items-center justify-between">
              <legend className="text-sm font-semibold">{t.product.selectSize}</legend>
              <SizeChartButton chartKey={product.metadata?.size_chart as string | undefined} />
            </div>
            <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={t.product.selectSize}>
              {[...sizes].sort(compareSizes).map((s) => {
                const v = variantFor(colour, s)
                const available = !!v && isVariantInStock(v)
                const on = s === size
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!available}
                    onClick={() => {
                      setSize(s)
                      setSizeError(false)
                      setAdded(false)
                    }}
                    className={`relative h-12 min-w-[3.25rem] rounded-full border px-3 text-[15px] font-medium transition-colors ${
                      on
                        ? "border-brand-600 bg-brand-600 text-white"
                        : available
                        ? "border-line bg-white hover:border-ink"
                        : "cursor-not-allowed border-line bg-surface text-muted line-through"
                    }`}
                    aria-label={available ? s : `${s} – ${t.product.soldOut}`}
                    data-testid={`size-${s}`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            <div aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm">
              {sizeError && <p className="text-danger">{t.product.pleaseSelectSize}</p>}
              {!sizeError && stock !== undefined && stock > 0 && stock <= LOW_STOCK && (
                <p className="font-semibold text-danger" data-testid="low-stock">
                  {format(t.product.onlyLeft, { count: stock })}
                </p>
              )}
            </div>
          </fieldset>
        )}

        {/* Buttons: inline on computers, fixed above the bottom bar on phones */}
        <div className="fixed inset-x-0 bottom-14 z-30 border-t border-line bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] small:static small:border-0 small:p-0">
          <div className="flex gap-3">
            {added ? (
              <LocalizedClientLink href="/cart" className="btn-accent flex-1" data-testid="go-to-bag">
                <CheckIcon size={20} />
                {t.product.goToBag}
              </LocalizedClientLink>
            ) : (
              <button
                type="button"
                onClick={onAdd}
                disabled={adding || soldOut}
                className="btn-primary flex-1"
                data-testid="add-product-button"
              >
                <BagIcon size={20} />
                {soldOut ? t.product.outOfStock : addLabel}
              </button>
            )}
          </div>
          {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
        </div>

        <PincodeCheck />
        {details}
      </div>
    </div>
  )
}
