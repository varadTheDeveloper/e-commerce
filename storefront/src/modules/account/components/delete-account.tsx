"use client"

import { deleteMyAccount } from "@lib/data/customer"
import { useI18n } from "@lib/i18n/provider"
import { useState } from "react"

/** "Delete my account" on the profile page (DPDP Act: right to erasure). */
export default function DeleteAccount() {
  const { t, locale } = useI18n()
  const d = t.account.deleteAccount
  const [open, setOpen] = useState(false)
  const [sure, setSure] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const remove = () => {
    setError(null)
    setPending(true)
    deleteMyAccount().then(
      (res) => {
        // A full page load: nothing of the deleted account stays in the browser
        if (res.ok) window.location.assign(new URL(`/${locale}`, window.location.origin))
        else {
          setPending(false)
          setError(res.error === "open_orders" ? d.openOrders : d.failed)
        }
      },
      () => {
        setPending(false)
        setError(d.failed)
      }
    )
  }

  return (
    <section className="mt-12 max-w-md border-t border-line pt-8" data-testid="delete-account">
      <h2 className="font-heading text-xl">{d.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{d.text}</p>
      {!open ? (
        <button type="button" className="btn-outline mt-4 h-11 px-6 text-sm" onClick={() => setOpen(true)} data-testid="delete-account-start">
          {d.button}
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-ink" checked={sure} onChange={(e) => setSure(e.target.checked)} data-testid="delete-account-confirm" />
            {d.confirm}
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              className="h-11 bg-danger px-6 text-sm text-white disabled:opacity-50"
              disabled={!sure || pending}
              onClick={remove}
              data-testid="delete-account-button"
            >
              {pending ? d.deleting : d.button}
            </button>
            <button type="button" className="btn-outline h-11 px-6 text-sm" onClick={() => setOpen(false)}>
              {t.account.cancel}
            </button>
          </div>
        </div>
      )}
      <p role="alert" className={error ? "mt-4 bg-brand-50 px-4 py-3 text-sm text-danger" : "sr-only"} data-testid="delete-account-error">
        {error}
      </p>
    </section>
  )
}
