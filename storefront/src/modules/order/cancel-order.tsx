"use client"

import { cancelOrder, CancelReason } from "@lib/data/orders"
import { useI18n } from "@lib/i18n/provider"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

const REASONS: CancelReason[] = ["changed_mind", "ordered_by_mistake", "found_cheaper", "delivery_too_late", "other"]

/** "Cancel order" with a reason; shown until the order is shipped. */
export default function CancelOrder({ orderId }: { orderId: string }) {
  const { t } = useI18n()
  const o = t.order
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<CancelReason | null>(null)
  const [failed, setFailed] = useState(false)
  const [pending, start] = useTransition()

  if (!open) {
    return (
      <button type="button" className="text-sm underline underline-offset-4" onClick={() => setOpen(true)} data-testid="cancel-order-button">
        {o.cancel}
      </button>
    )
  }

  return (
    <form
      className="flex flex-col gap-3 border border-ink bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!reason) return
        setFailed(false)
        start(async () => {
          const res = await cancelOrder(orderId, reason)
          if (res.ok) router.refresh()
          else setFailed(true)
        })
      }}
      data-testid="cancel-order-form"
    >
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-2 font-medium">{o.cancelTitle}</legend>
        {REASONS.map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-3">
            <input type="radio" name="reason" className="h-4 w-4 accent-ink" checked={reason === r} onChange={() => setReason(r)} />
            {o.reasons[r]}
          </label>
        ))}
      </fieldset>
      {failed && (
        <p role="alert" className="text-sm text-danger">
          {o.cancelFailed}
        </p>
      )}
      <div className="flex gap-3">
        <button type="submit" className="btn-primary flex-1 small:flex-none small:px-8" disabled={!reason || pending} data-testid="confirm-cancel-button">
          {pending ? o.cancelling : o.confirmCancel}
        </button>
        <button type="button" className="btn-outline" disabled={pending} onClick={() => setOpen(false)}>
          {o.keepOrder}
        </button>
      </div>
    </form>
  )
}
