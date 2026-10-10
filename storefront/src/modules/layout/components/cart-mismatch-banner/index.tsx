"use client"

import { transferCart } from "@lib/data/customer"
import { useI18n } from "@lib/i18n/provider"
import { StoreCart, StoreCustomer } from "@medusajs/types"
import { useState } from "react"

/** Shown when a logged-in customer's bag could not be moved to their account. */
function CartMismatchBanner(props: { customer: StoreCustomer; cart: StoreCart }) {
  const { customer, cart } = props
  const { t } = useI18n()
  const [isPending, setIsPending] = useState(false)

  if (!customer || !!cart.customer_id) {
    return null
  }

  const handleSubmit = async () => {
    try {
      setIsPending(true)
      await transferCart()
    } catch {
      setIsPending(false)
    }
  }

  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-1 bg-accent-100 p-2 text-center text-sm text-ink small:flex-row small:gap-2 small:p-3">
      <span>{t.cartMismatch.text}</span>
      <button type="button" disabled={isPending} onClick={handleSubmit} className="font-semibold text-brand-700 underline disabled:text-muted">
        {isPending ? t.cartMismatch.transferring : t.cartMismatch.retry}
      </button>
    </div>
  )
}

export default CartMismatchBanner
