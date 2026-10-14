"use client"

import { deleteLineItem, updateLineItem } from "@lib/data/cart"
import { format } from "@lib/i18n"
import { colourName } from "@lib/i18n/colours"
import { useI18n } from "@lib/i18n/provider"
import { formatINR } from "@lib/util/money"
import { useWishlist } from "@lib/wishlist"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { useState, useTransition } from "react"

const MAX_QTY = 10

type Line = HttpTypes.StoreCartLineItem

/** Name, size, colour and picture of a bag line, looked up in the catalogue (in the page language). */
export type LineDetails = { title?: string; size?: string; colour?: string; image?: string }

/** MRP and selling price for a line (MRP falls back to the selling price). */
export function linePrices(item: Line) {
  const price = item.unit_price ?? 0
  const mrp = Math.max(item.compare_at_unit_price ?? price, price)
  return { price, mrp, qty: item.quantity }
}

export function bagTotals(items: Line[]) {
  let mrp = 0
  let price = 0
  for (const i of items) {
    const p = linePrices(i)
    mrp += p.mrp * p.qty
    price += p.price * p.qty
  }
  return { mrp, price, discount: mrp - price }
}

export default function BagView({
  cart,
  loggedIn,
  details,
}: {
  cart: HttpTypes.StoreCart
  loggedIn: boolean
  details: Record<string, LineDetails>
}) {
  const { locale, t } = useI18n()
  const wishlist = useWishlist()
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const items = [...(cart.items ?? [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  const count = items.reduce((n, i) => n + i.quantity, 0)
  const totals = bagTotals(items)

  const run = (lineId: string, fn: () => Promise<unknown>) => {
    setError(null)
    setBusy(lineId)
    start(async () => {
      try {
        // The bag actions update the cart's cache tag (updateTag), which refreshes this page by itself
        await fn()
      } catch {
        setError(t.bag.updateFailed)
      } finally {
        setBusy(null)
      }
    })
  }

  return (
    <div className="content-container py-6 small:py-10" data-testid="cart-container">
      <h1 className="heading-lg">
        {t.bag.title}{" "}
        <span className="font-sans text-sm text-muted">{count === 1 ? t.bag.itemsOne : format(t.bag.itemsCount, { count })}</span>
      </h1>

      {!loggedIn && (
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-4 py-3 text-sm">
          {t.bag.loginPrompt}
          <LocalizedClientLink href="/account" prefetch={false} className="font-medium underline underline-offset-4">
            {t.bag.loginCta}
          </LocalizedClientLink>
        </p>
      )}

      <div className="mt-6 small:grid small:grid-cols-[1fr_360px] small:gap-12">
        <div>
          {error && (
            <p role="alert" className="mb-3 bg-brand-50 px-4 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <ul className="divide-y divide-line border-y border-line">
            {items.map((item) => {
              const p = linePrices(item)
              const d = details[item.id] ?? {}
              const { size, colour } = d
              const handle = item.product_handle ?? item.product?.handle ?? ""
              const off = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0
              const lineBusy = busy === item.id && pending
              const image = d.image ?? item.thumbnail
              return (
                <li key={item.id} className={`flex gap-4 py-5 ${lineBusy ? "opacity-60" : ""}`} data-testid="bag-item">
                  {/* Same link as the title: hidden from screen readers and the keyboard */}
                  <LocalizedClientLink
                    href={`/products/${handle}`}
                    aria-hidden="true"
                    tabIndex={-1}
                    className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden bg-surface small:w-28"
                  >
                    {image && <Image src={image} alt="" fill sizes="112px" className="object-cover" />}
                  </LocalizedClientLink>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <LocalizedClientLink href={`/products/${handle}`} className="line-clamp-2 text-[15px] hover:underline" data-testid="bag-item-title">
                      {d.title ?? item.product_title}
                    </LocalizedClientLink>
                    <p className="text-[13px] text-muted">
                      {size && `${t.bag.size}: ${size}`}
                      {size && colour && " · "}
                      {colour && `${t.bag.colour}: ${colourName(colour, locale)}`}
                    </p>
                    <p className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
                      <span className="font-medium" data-testid="bag-item-price">{formatINR(p.price * p.qty)}</span>
                      {off > 0 && (
                        <>
                          <span className="text-[13px] text-muted line-through">{formatINR(p.mrp * p.qty)}</span>
                          <span className="text-[13px] text-saving">{format(t.product.off, { percent: off })}</span>
                        </>
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
                      <div className="flex items-center border border-line" role="group" aria-label={t.bag.quantity}>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center text-lg disabled:text-muted"
                          aria-label={t.bag.decrease}
                          disabled={pending || item.quantity <= 1}
                          onClick={() => run(item.id, () => updateLineItem({ lineId: item.id, quantity: item.quantity - 1 }))}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm" data-testid="bag-item-qty">{item.quantity}</span>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center text-lg disabled:text-muted"
                          aria-label={t.bag.increase}
                          disabled={pending || item.quantity >= MAX_QTY}
                          onClick={() => run(item.id, () => updateLineItem({ lineId: item.id, quantity: item.quantity + 1 }))}
                          data-testid="bag-item-increase"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="text-[13px] underline underline-offset-4"
                        disabled={pending}
                        onClick={() => run(item.id, () => deleteLineItem(item.id))}
                        data-testid="bag-item-remove"
                      >
                        {t.bag.remove}
                      </button>
                      {handle && (
                        <button
                          type="button"
                          className="text-[13px] underline underline-offset-4"
                          disabled={pending}
                          onClick={() =>
                            run(item.id, async () => {
                              if (!wishlist.has(handle)) wishlist.toggle(handle)
                              await deleteLineItem(item.id)
                            })
                          }
                        >
                          {t.bag.moveToWishlist}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <aside className="mt-8 small:mt-0" aria-label={t.bag.priceDetails}>
          <div className="border border-line bg-white p-5 small:sticky small:top-36">
            <h2 className="eyebrow mb-4">{t.bag.priceDetails}</h2>
            <dl className="flex flex-col gap-3 text-sm" data-testid="bag-summary">
              <div className="flex justify-between">
                <dt>{t.bag.totalMrp}</dt>
                <dd>{formatINR(totals.mrp)}</dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between">
                  <dt>{t.bag.discount}</dt>
                  <dd className="text-saving">−{formatINR(totals.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>{t.bag.delivery}</dt>
                <dd className="text-muted">{t.bag.deliveryAtCheckout}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-base font-medium">
                <dt>{t.bag.total}</dt>
                <dd data-testid="bag-total">{formatINR(totals.price)}</dd>
              </div>
            </dl>
            {totals.discount > 0 && (
              <p className="mt-3 bg-brand-50 px-3 py-2 text-[13px] text-saving">{format(t.bag.youSave, { amount: formatINR(totals.discount) })}</p>
            )}
            <LocalizedClientLink href="/checkout?step=address" prefetch={false} className="btn-primary mt-5 hidden w-full small:flex" data-testid="checkout-button">
              {t.bag.placeOrder}
            </LocalizedClientLink>
          </div>
        </aside>
      </div>

      {/* Phones: total and button stay above the bottom bar */}
      <div className="fixed inset-x-0 bottom-14 z-30 flex items-center gap-4 border-t border-line bg-white p-3 small:hidden">
        <div className="flex-1">
          <p className="text-base font-medium">{formatINR(totals.price)}</p>
          {totals.discount > 0 && <p className="text-xs text-saving">−{formatINR(totals.discount)}</p>}
        </div>
        <LocalizedClientLink href="/checkout?step=address" prefetch={false} className="btn-primary flex-1">
          {t.bag.placeOrder}
        </LocalizedClientLink>
      </div>
      <div className="h-20 small:hidden" />
    </div>
  )
}
