"use client"

import { BRAND } from "@config/brand"
import {
  CheckoutError,
  confirmCodAndPlaceOrder,
  placeOrder,
  requestCodCode,
  setDeliveryAddress,
  ShopSettings,
  startOnlinePayment,
} from "@lib/data/checkout"
import { format } from "@lib/i18n"
import { colourName } from "@lib/i18n/colours"
import { useI18n } from "@lib/i18n/provider"
import { formatMobile } from "@lib/india"
import { formatINR } from "@lib/util/money"
import { DeliveryEstimate } from "@lib/data/delivery"
import { shortDate } from "@lib/util/dates"
import { HttpTypes } from "@medusajs/types"
import PhoneLogin from "@modules/account/components/phone-login"
import { AddressForm, toInput } from "@modules/account/components/address-book"
import { bagTotals, LineDetails, linePrices } from "@modules/bag/bag-view"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

type Method = "online" | "cod"

type Props = {
  cart: HttpTypes.StoreCart
  customer: HttpTypes.StoreCustomer | null
  settings: ShopSettings | null
  details: Record<string, LineDetails>
  /** Courier check for the chosen address (null when not known) */
  estimate: DeliveryEstimate | null
}

const AUTH_ERRORS = ["wrong_code", "locked", "too_soon", "too_many", "sms_failed"] as const

/** Is this saved address the one on the cart? */
function sameAddress(a: HttpTypes.StoreCustomerAddress, b?: HttpTypes.StoreCartAddress | null) {
  return !!b && a.address_1 === b.address_1 && a.postal_code === b.postal_code && a.phone === b.phone && a.first_name === b.first_name
}

function loadRazorpay(): Promise<boolean> {
  if ((window as any).Razorpay) return Promise.resolve(true)
  return new Promise((resolve) => {
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function CheckoutView({ cart, customer, settings, details, estimate }: Props) {
  const { locale, t } = useI18n()
  const c = t.checkout
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<{ code: CheckoutError; items?: string[] } | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [chosenMethod, setMethod] = useState<Method>("online")
  const [status, setStatus] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cod, setCod] = useState<{ phone: string } | null>(null)
  const [code, setCode] = useState("")
  const autoPicked = useRef(false)

  const addresses = customer?.addresses ?? []
  const shipping = cart.shipping_address
  const hasDelivery = !!shipping && !!cart.shipping_methods?.length
  const items = [...(cart.items ?? [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  const totals = bagTotals(items)
  const itemTotal = cart.item_total ?? totals.price
  const expectedFee = settings && itemTotal < settings.free_shipping_from ? settings.shipping_fee : 0
  const deliveryFee = hasDelivery ? cart.shipping_total ?? 0 : expectedFee
  const total = hasDelivery ? cart.total ?? itemTotal + deliveryFee : itemTotal + deliveryFee
  const serviceable = !estimate?.checked || estimate.serviceable
  const codHere = !estimate?.checked || estimate.cod
  const withinCodLimit = !settings || total <= settings.cod_max_order
  const codAllowed = withinCodLimit && codHere
  // Cash on delivery chosen, then no longer possible (bigger total, other pincode): pay online
  const method: Method = !codAllowed && chosenMethod === "cod" ? "online" : chosenMethod
  const canPay = hasDelivery && serviceable
  const toFree = settings ? settings.free_shipping_from - itemTotal : 0

  // Use the default (or only) saved address straight away
  useEffect(() => {
    const saved = customer?.addresses ?? []
    if (shipping || !saved.length || autoPicked.current) return
    autoPicked.current = true
    const preferred = saved.find((a) => a.is_default_shipping) ?? saved[0]
    start(async () => {
      await setDeliveryAddress(preferred.id)
      router.refresh()
    })
  }, [customer, shipping, router])


  const fail = (res: { error: CheckoutError; items?: string[] }) => {
    setStatus(null)
    setError({ code: res.error, items: res.items })
  }

  const chooseAddress = (id?: string) => {
    setError(null)
    start(async () => {
      const res = await setDeliveryAddress(id)
      if (!res.ok) fail(res)
      setChoosing(false)
      setAdding(false)
      router.refresh()
    })
  }

  const done = (orderId: string) => router.push(`/${locale}/order/${orderId}/confirmed`)

  const payOnline = () => {
    setError(null)
    setNotice(null)
    setStatus(c.opening)
    start(async () => {
      const res = await startOnlinePayment()
      if (!res.ok) return fail(res)
      if (!(await loadRazorpay())) return fail({ error: "payment_unavailable" })
      const Razorpay = (window as any).Razorpay
      const checkout = new Razorpay({
        key: res.keyId,
        order_id: res.orderId,
        amount: res.amount,
        currency: "INR",
        name: BRAND.name,
        prefill: { name: res.name, contact: res.phone, email: res.email },
        theme: { color: "#7a1f2b" },
        handler: () => {
          setStatus(c.placing)
          start(async () => {
            const placed = await placeOrder("online")
            if (placed.ok) done(placed.orderId)
            else fail(placed)
          })
        },
        modal: {
          ondismiss: () => {
            setStatus(null)
            setNotice(c.paymentCancelled)
          },
        },
      })
      checkout.on("payment.failed", () => {
        setStatus(null)
      })
      setStatus(null)
      checkout.open()
    })
  }

  const startCod = () => {
    setError(null)
    setStatus(c.placing)
    start(async () => {
      const res = await requestCodCode()
      if (!res.ok) return fail(res)
      if (!res.needsCode) {
        const placed = await confirmCodAndPlaceOrder()
        return placed.ok ? done(placed.orderId) : fail(placed)
      }
      setStatus(null)
      setCode("")
      setCod({ phone: res.phone })
    })
  }

  const confirmCod = (value = code) => {
    if (!/^\d{6}$/.test(value)) return
    setError(null)
    setStatus(c.placing)
    start(async () => {
      const placed = await confirmCodAndPlaceOrder(value)
      if (placed.ok) return done(placed.orderId)
      setCode("")
      fail(placed)
    })
  }

  const errorText = error
    ? (AUTH_ERRORS as readonly string[]).includes(error.code)
      ? t.auth.errors[error.code as (typeof AUTH_ERRORS)[number]]
      : format(c.errors[error.code as keyof typeof c.errors] ?? c.errors.generic, { items: (error.items ?? []).join(", ") })
    : null

  const section = "border border-line bg-white p-5 small:p-6"
  const stepTitle = (n: number, title: string, active: boolean) => (
    <h2 className={`flex items-center gap-3 font-heading text-xl ${active ? "" : "text-muted"}`}>
      <span className={`flex h-7 w-7 items-center justify-center text-sm font-sans ${active ? "bg-ink text-white" : "bg-surface text-muted"}`}>{n}</span>
      {title}
    </h2>
  )

  return (
    <div className="content-container py-6 small:py-10">
      {customer && <h1 className="sr-only">{c.title}</h1>}
      <div className="small:grid small:grid-cols-[1fr_360px] small:gap-10">
        <div className="flex flex-col gap-4">
          {!customer ? (
            <section className={section} data-testid="checkout-login">
              <p className="mb-2 text-sm text-muted">{c.loginTitle}</p>
              <PhoneLogin />
            </section>
          ) : (
            <>
              {/* 1. Address */}
              <section className={section} data-testid="checkout-address">
                <div className="flex items-start justify-between gap-4">
                  {stepTitle(1, c.address, true)}
                  {hasDelivery && !choosing && (
                    <button type="button" className="text-sm underline underline-offset-4" onClick={() => setChoosing(true)} data-testid="change-address">
                      {c.change}
                    </button>
                  )}
                </div>

                {hasDelivery && !choosing ? (
                  <div className="mt-4 text-sm leading-relaxed" data-testid="chosen-address">
                    <p className="font-medium">{shipping!.first_name}</p>
                    <p className="text-muted">
                      {[shipping!.address_1, shipping!.address_2, (shipping!.metadata as { landmark?: string } | null)?.landmark].filter(Boolean).join(", ")}
                      <br />
                      {shipping!.city}, {shipping!.province} {shipping!.postal_code}
                      <br />
                      {formatMobile(shipping!.phone)}
                    </p>
                    {!serviceable ? (
                      <p className="mt-3 text-[13px] text-danger" data-testid="checkout-delivery-date">{c.errors.not_serviceable}</p>
                    ) : (
                      <p className="mt-3 text-[13px] text-saving" data-testid="checkout-delivery-date">
                        {estimate?.date ? format(t.product.deliveryBy, { date: shortDate(estimate.date, locale) }) : c.deliveryTime}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col gap-3">
                    {!addresses.length && !adding && <p className="text-sm text-muted">{c.noAddress}</p>}
                    {!adding &&
                      addresses.map((a) => (
                        <div key={a.id} className={`flex flex-col gap-2 border p-4 text-sm ${sameAddress(a, shipping) ? "border-ink" : "border-line"}`} data-testid="checkout-address-option">
                          <p className="font-medium">{a.first_name}</p>
                          <p className="text-muted">
                            {[a.address_1, a.address_2].filter(Boolean).join(", ")}, {a.city}, {a.province} {a.postal_code}
                            <br />
                            {formatMobile(a.phone)}
                          </p>
                          <button type="button" className="btn-primary mt-1 h-10 self-start px-6 text-sm" disabled={pending} onClick={() => chooseAddress(a.id)} data-testid="deliver-here">
                            {c.deliverHere}
                          </button>
                        </div>
                      ))}
                    {adding ? (
                      <AddressForm
                        id={null}
                        initial={toInput(undefined, customer)}
                        title={c.addNewAddress}
                        onCancel={() => setAdding(false)}
                        onSaved={() => chooseAddress()}
                      />
                    ) : (
                      <button type="button" className="btn-outline h-11 self-start px-5 text-sm" onClick={() => setAdding(true)} data-testid="add-address-button">
                        + {c.addNewAddress}
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* 2. Payment */}
              <section className={section} data-testid="checkout-payment">
                {stepTitle(2, c.payment, canPay && !choosing)}
                {canPay && !choosing && (
                  <div className="mt-4 flex flex-col gap-3">
                    <fieldset className="flex flex-col gap-3" disabled={pending || !!cod}>
                      <legend className="sr-only">{c.payment}</legend>
                      <label className={`flex cursor-pointer items-start gap-3 border p-4 ${method === "online" ? "border-ink" : "border-line"}`}>
                        <input type="radio" name="method" className="mt-1 h-4 w-4 accent-ink" checked={method === "online"} onChange={() => setMethod("online")} data-testid="pay-online-option" />
                        <span>
                          <span className="block font-medium">{c.payOnline}</span>
                          <span className="text-[13px] text-muted">{c.payOnlineNote}</span>
                        </span>
                      </label>
                      <label className={`flex items-start gap-3 border p-4 ${!codAllowed ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${method === "cod" ? "border-ink" : "border-line"}`}>
                        <input type="radio" name="method" className="mt-1 h-4 w-4 accent-ink" checked={method === "cod"} disabled={!codAllowed} onChange={() => setMethod("cod")} data-testid="cod-option" />
                        <span>
                          <span className="block font-medium">{c.cod}</span>
                          <span className="text-[13px] text-muted">
                            {codAllowed
                              ? c.codNote
                              : !codHere
                                ? t.product.codUnavailable
                                : format(c.codLimit, { amount: formatINR(settings!.cod_max_order) })}
                          </span>
                        </span>
                      </label>
                    </fieldset>

                    {cod ? (
                      <form
                        className="flex flex-col gap-3 border border-ink p-4"
                        onSubmit={(e) => {
                          e.preventDefault()
                          confirmCod()
                        }}
                        data-testid="cod-code-form"
                      >
                        <p className="font-medium">{c.codTitle}</p>
                        <p className="text-sm text-muted">{format(c.codSentTo, { phone: cod.phone })}</p>
                        <input
                          className="h-12 w-full border border-line bg-white px-4 text-center text-2xl tracking-[0.5em] focus:border-ink focus:outline-none"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={code}
                          aria-label={t.auth.codeLabel}
                          autoFocus
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 6)
                            setCode(v)
                            if (v.length === 6) confirmCod(v)
                          }}
                          data-testid="cod-code-input"
                        />
                        <div className="flex gap-3">
                          <button type="submit" className="btn-primary flex-1" disabled={pending || code.length !== 6}>
                            {pending ? c.placing : c.confirm}
                          </button>
                          <button type="button" className="btn-outline" disabled={pending} onClick={() => setCod(null)}>
                            {t.account.cancel}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary hidden w-full small:flex"
                        disabled={pending}
                        onClick={method === "online" ? payOnline : startCod}
                        data-testid="submit-order-button"
                      >
                        {status ?? (method === "online" ? format(c.pay, { amount: formatINR(total) }) : c.placeCodOrder)}
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          {notice && !errorText && (
            <p role="status" className="bg-surface px-4 py-3 text-sm" data-testid="checkout-notice">
              {notice}
            </p>
          )}
          <p role="alert" aria-live="assertive" className={errorText ? "bg-brand-50 px-4 py-3 text-sm text-danger" : "sr-only"} data-testid="checkout-error">
            {errorText}
          </p>
        </div>

        {/* Order summary */}
        <aside className="mt-6 small:mt-0" aria-label={c.summary}>
          <div className="border border-line bg-white p-5 small:sticky small:top-6">
            <h2 className="eyebrow mb-4">{c.summary}</h2>
            <ul className="flex flex-col gap-4 border-b border-line pb-4">
              {items.map((item) => {
                const d = details[item.id] ?? {}
                const p = linePrices(item)
                const image = d.image ?? item.thumbnail
                return (
                  <li key={item.id} className="flex gap-3" data-testid="checkout-item">
                    <div className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden bg-surface">
                      {image && <Image src={image} alt="" fill sizes="56px" className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1 text-[13px]">
                      <p className="line-clamp-2 text-sm">{d.title ?? item.product_title}</p>
                      <p className="text-muted">
                        {[d.size && `${t.bag.size}: ${d.size}`, d.colour && `${t.bag.colour}: ${colourName(d.colour, locale)}`, `× ${item.quantity}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <p className="text-sm">{formatINR(p.price * p.qty)}</p>
                  </li>
                )
              })}
            </ul>
            <dl className="mt-4 flex flex-col gap-3 text-sm" data-testid="checkout-summary">
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
                <dd data-testid="checkout-delivery">{deliveryFee > 0 ? formatINR(deliveryFee) : <span className="text-saving">{c.free}</span>}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-base font-medium">
                <dt>{t.bag.total}</dt>
                <dd data-testid="checkout-total">{formatINR(total)}</dd>
              </div>
            </dl>
            {toFree > 0 && <p className="mt-3 bg-surface px-3 py-2 text-[13px]">{format(c.addMoreForFree, { amount: formatINR(toFree) })}</p>}
            {totals.discount > 0 && (
              <p className="mt-3 bg-brand-50 px-3 py-2 text-[13px] text-saving">{format(t.bag.youSave, { amount: formatINR(totals.discount) })}</p>
            )}
          </div>
        </aside>
      </div>

      {/* Phones: total and button stay at the bottom */}
      {customer && canPay && !choosing && !cod && (
        <>
          <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t border-line bg-white p-3 small:hidden">
            <p className="flex-1 text-base font-medium">{formatINR(total)}</p>
            <button type="button" className="btn-primary flex-1" disabled={pending} onClick={method === "online" ? payOnline : startCod} data-testid="submit-order-button-mobile">
              {status ?? (method === "online" ? format(c.pay, { amount: formatINR(total) }) : c.placeCodOrder)}
            </button>
          </div>
          <div className="h-20 small:hidden" />
        </>
      )}
    </div>
  )
}
