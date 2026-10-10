import { Dictionary, format } from "@lib/i18n"
import { PriceInfo } from "@lib/util/catalog"
import { formatINR } from "@lib/util/money"

/** ₹499  ₹799  37% off — selling price, MRP struck through, saving in green. */
export default function Price({
  info,
  t,
  size = "sm",
}: {
  info: PriceInfo
  t: Dictionary
  size?: "sm" | "lg"
}) {
  const big = size === "lg"
  return (
    <p className={`flex flex-wrap items-baseline gap-x-2 ${big ? "text-xl" : "text-[14px]"}`} data-testid="product-price" data-amount={info.price}>
      <span className="font-medium text-ink">{formatINR(info.price)}</span>
      {info.discountPercent > 0 && (
        <>
          <span className={`text-muted line-through ${big ? "text-base" : "text-[13px]"}`}>
            <span className="sr-only">{t.product.mrp} </span>
            {formatINR(info.mrp)}
          </span>
          <span className={`text-saving ${big ? "text-base" : "text-[13px]"}`}>
            {format(t.product.off, { percent: info.discountPercent })}
          </span>
        </>
      )}
    </p>
  )
}
