"use client"

import { updateCustomer } from "@lib/data/customer"
import { useI18n } from "@lib/i18n/provider"
import { formatMobile } from "@lib/india"
import { HttpTypes } from "@medusajs/types"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

const field = "h-12 w-full border border-line bg-white px-4 text-[16px] text-ink focus:border-ink focus:outline-none"

export default function ProfileForm({ customer }: { customer: HttpTypes.StoreCustomer }) {
  const { t } = useI18n()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle")

  const submit = (form: FormData) => {
    const firstName = String(form.get("first_name") ?? "").trim()
    if (!firstName) {
      setStatus("error")
      return
    }
    start(async () => {
      try {
        await updateCustomer({
          first_name: firstName.slice(0, 60),
          last_name: String(form.get("last_name") ?? "").trim().slice(0, 60),
        })
        setStatus("saved")
        router.refresh()
      } catch {
        setStatus("error")
      }
    })
  }

  return (
    <form action={submit} className="flex max-w-md flex-col gap-4" data-testid="profile-form">
      <h1 className="heading-lg">{t.account.profile}</h1>
      <label className="flex flex-col gap-1.5 text-sm">
        {t.auth.firstName}
        <input className={field} name="first_name" defaultValue={customer.first_name ?? ""} maxLength={60} required autoComplete="given-name" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        {t.auth.lastName}
        <input className={field} name="last_name" defaultValue={customer.last_name ?? ""} maxLength={60} autoComplete="family-name" />
      </label>
      <div className="flex flex-col gap-1.5 text-sm">
        {t.account.phone}
        <p className="flex h-12 items-center border border-line bg-surface px-4 text-[16px] text-muted">{formatMobile(customer.phone)}</p>
        <p className="text-xs text-muted">{t.account.phoneNote}</p>
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        {t.account.email}
        <p className="flex h-12 items-center border border-line bg-surface px-4 text-[16px] text-muted">{customer.email || t.account.notSet}</p>
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary px-10" disabled={pending}>
          {pending ? t.account.saving : t.account.save}
        </button>
        <span role="status" className={`text-sm ${status === "error" ? "text-danger" : "text-muted"}`}>
          {status === "saved" ? t.account.saved : status === "error" ? t.auth.errors.invalid_name : ""}
        </span>
      </div>
    </form>
  )
}
