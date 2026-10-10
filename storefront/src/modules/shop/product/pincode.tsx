"use client"

import { useI18n } from "@lib/i18n/provider"
import { PinIcon, TruckIcon } from "@modules/common/icons/ui"
import { useState } from "react"

/**
 * Pincode check. For now it only validates the number and shows the general
 * delivery promise; real courier dates come with Shiprocket in Step 5.
 */
export default function PincodeCheck() {
  const { t } = useI18n()
  const [pin, setPin] = useState("")
  const [state, setState] = useState<"idle" | "ok" | "bad">("idle")

  const check = (e: React.FormEvent) => {
    e.preventDefault()
    // Indian pincodes: 6 digits, first digit 1-9
    setState(/^[1-9][0-9]{5}$/.test(pin) ? "ok" : "bad")
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <p className="mb-2 flex items-center gap-2 font-semibold">
        <TruckIcon size={20} className="text-brand-600" />
        {t.product.delivery}
      </p>
      <form onSubmit={check} className="flex gap-2">
        <div className="relative flex-1">
          <PinIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              setState("idle")
            }}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder={t.product.pincodePlaceholder}
            aria-label={t.product.pincodePlaceholder}
            className="h-11 w-full rounded-lg border border-line pl-9 pr-3 focus:border-brand-500 focus:outline-none"
            data-testid="pincode-input"
          />
        </div>
        <button type="submit" className="h-11 rounded-lg px-4 font-semibold text-brand-600 hover:bg-brand-50">
          {t.product.check}
        </button>
      </form>
      <div aria-live="polite" className="mt-2 text-sm" data-testid="pincode-result">
        {state === "ok" && (
          <>
            <p className="text-saving">{t.product.pincodeResult}</p>
            <p className="text-xs text-muted">{t.product.pincodeNote}</p>
          </>
        )}
        {state === "bad" && <p className="text-danger">{t.product.pincodeInvalid}</p>}
      </div>
    </div>
  )
}
