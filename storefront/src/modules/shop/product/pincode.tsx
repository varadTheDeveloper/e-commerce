"use client"

import { DeliveryEstimate, getDeliveryEstimate } from "@lib/data/delivery"
import { format } from "@lib/i18n"
import { useI18n } from "@lib/i18n/provider"
import { shortDate } from "@lib/util/dates"
import { PinIcon, TruckIcon } from "@modules/common/icons/ui"
import { useState, useTransition } from "react"

/** Pincode check: can we deliver there, by when, and is cash on delivery possible. */
export default function PincodeCheck() {
  const { locale, t } = useI18n()
  const [pin, setPin] = useState("")
  const [result, setResult] = useState<DeliveryEstimate | "bad" | null>(null)
  const [pending, start] = useTransition()

  const check = (e: React.FormEvent) => {
    e.preventDefault()
    // Indian pincodes: 6 digits, first digit 1-9
    if (!/^[1-9][0-9]{5}$/.test(pin)) return setResult("bad")
    start(async () => {
      const estimate = await getDeliveryEstimate(pin)
      setResult(estimate ?? { serviceable: true, cod: true, date: null, checked: false })
    })
  }

  return (
    <div className="border-t border-line pt-5">
      <p className="mb-3 flex items-center gap-2 text-sm">
        <TruckIcon size={20} strokeWidth={1.5} />
        {t.product.delivery}
      </p>
      <form onSubmit={check} className="flex gap-2">
        <div className="relative flex-1">
          <PinIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              setResult(null)
            }}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder={t.product.pincodePlaceholder}
            aria-label={t.product.pincodePlaceholder}
            className="h-11 w-full border border-line bg-white pl-9 pr-3 focus:border-ink focus:outline-none"
            data-testid="pincode-input"
          />
        </div>
        <button type="submit" className="h-11 border border-ink px-5 text-sm hover:bg-ink hover:text-white" disabled={pending}>
          {t.product.check}
        </button>
      </form>
      <div aria-live="polite" className="mt-2 text-sm" data-testid="pincode-result">
        {pending && <p className="text-muted">{t.product.checking}</p>}
        {!pending && result === "bad" && <p className="text-danger">{t.product.pincodeInvalid}</p>}
        {!pending && result && result !== "bad" && !result.serviceable && <p className="text-danger">{t.product.notServiceable}</p>}
        {!pending && result && result !== "bad" && result.serviceable && (
          <>
            <p className="text-saving">{result.date ? format(t.product.deliveryBy, { date: shortDate(result.date, locale) }) : t.product.pincodeResult}</p>
            {result.checked && <p className="text-xs text-muted">{result.cod ? t.product.codAvailable : t.product.codUnavailable}</p>}
          </>
        )}
      </div>
    </div>
  )
}
