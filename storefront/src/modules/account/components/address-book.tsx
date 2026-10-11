"use client"

import { AddressError, AddressInput, deleteAddress, makeDefaultAddress, saveAddress } from "@lib/data/addresses"
import { formatMobile, INDIAN_STATES, localMobile } from "@lib/india"
import { useI18n } from "@lib/i18n/provider"
import { HttpTypes } from "@medusajs/types"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

const field =
  "h-12 w-full border border-line bg-white px-4 text-[16px] text-ink focus:border-ink focus:outline-none aria-[invalid=true]:border-danger"

export function toInput(a?: HttpTypes.StoreCustomerAddress, customer?: HttpTypes.StoreCustomer): AddressInput {
  const meta = (a?.metadata ?? {}) as { landmark?: string; type?: string }
  return {
    fullName: a?.first_name ?? [customer?.first_name, customer?.last_name].filter(Boolean).join(" "),
    phone: localMobile(a?.phone ?? customer?.phone),
    pincode: a?.postal_code ?? "",
    house: a?.address_1 ?? "",
    area: a?.address_2 ?? "",
    landmark: meta.landmark ?? "",
    city: a?.city ?? "",
    state: a?.province ?? "Maharashtra",
    type: meta.type === "work" ? "work" : "home",
    isDefault: a ? !!a.is_default_shipping : !customer?.addresses?.length,
  }
}

export default function AddressBook({ customer }: { customer: HttpTypes.StoreCustomer }) {
  const { t } = useI18n()
  const router = useRouter()
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const [pending, start] = useTransition()
  const addresses = customer.addresses ?? []

  const act = (fn: () => Promise<void>) =>
    start(async () => {
      await fn()
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-6" data-testid="addresses-page-wrapper">
      <div className="flex items-end justify-between">
        <h1 className="heading-lg">{t.account.addresses}</h1>
        {editing === null && (
          <button type="button" className="btn-outline h-10 px-4 text-sm" onClick={() => setEditing("new")} data-testid="add-address-button">
            + {t.account.addAddress}
          </button>
        )}
      </div>

      {editing === "new" && (
        <AddressForm
          initial={toInput(undefined, customer)}
          title={t.account.addAddress}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
          id={null}
        />
      )}

      {!addresses.length && editing === null && <p className="bg-surface p-6 text-muted">{t.account.noAddresses}</p>}

      <ul className="grid gap-3 small:grid-cols-2">
        {addresses.map((a) =>
          editing === a.id ? (
            <li key={a.id} className="small:col-span-2">
              <AddressForm
                initial={toInput(a)}
                title={t.account.editAddress}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null)
                  router.refresh()
                }}
                id={a.id}
              />
            </li>
          ) : (
            <li key={a.id} className="flex flex-col gap-3 border border-line bg-white p-5" data-testid="address-card">
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.first_name}</span>
                <span className="border border-line px-2 py-0.5 text-[11px] text-muted">
                  {(a.metadata as { type?: string } | null)?.type === "work" ? t.account.address.work : t.account.address.home}
                </span>
                {a.is_default_shipping && <span className="bg-ink px-2 py-0.5 text-[11px] text-white">{t.account.defaultBadge}</span>}
              </div>
              <p className="text-sm leading-relaxed text-muted">
                {[a.address_1, a.address_2, (a.metadata as { landmark?: string } | null)?.landmark].filter(Boolean).join(", ")}
                <br />
                {a.city}, {a.province} {a.postal_code}
                <br />
                {formatMobile(a.phone)}
              </p>
              <div className="flex gap-4 text-sm">
                <button type="button" className="underline underline-offset-4" onClick={() => setEditing(a.id)} disabled={pending}>
                  {t.account.edit}
                </button>
                {!a.is_default_shipping && (
                  <button type="button" className="underline underline-offset-4" onClick={() => act(() => makeDefaultAddress(a.id))} disabled={pending}>
                    {t.account.makeDefault}
                  </button>
                )}
                <button
                  type="button"
                  className="text-danger underline underline-offset-4"
                  disabled={pending}
                  onClick={() => window.confirm(t.account.deleteConfirm) && act(() => deleteAddress(a.id))}
                >
                  {t.account.delete}
                </button>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  )
}

export function AddressForm({
  id,
  initial,
  title,
  onCancel,
  onSaved,
}: {
  id: string | null
  initial: AddressInput
  title: string
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const a = t.account.address
  const [value, setValue] = useState<AddressInput>(initial)
  const [error, setError] = useState<AddressError | null>(null)
  const [pending, start] = useTransition()

  const set = (k: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValue((v) => ({ ...v, [k]: e.target.value }))
  const bad = (k: keyof AddressInput) => error?.field === k
  const message = error ? (error.code === "failed" ? t.auth.errors.generic : a[error.code]) : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await saveAddress(id, value)
      if (res.ok) onSaved()
      else setError(res.error)
    })
  }

  const text = (k: keyof AddressInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex flex-col gap-1.5 text-sm">
      {label}
      <input className={field} value={String(value[k] ?? "")} onChange={set(k)} aria-invalid={bad(k)} name={k} {...props} />
    </label>
  )

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border border-ink bg-white p-5" data-testid="address-form">
      <h2 className="font-heading text-xl">{title}</h2>
      <div className="grid gap-4 small:grid-cols-2">
        {text("fullName", a.fullName, { autoComplete: "name", maxLength: 80 })}
        {text("phone", a.phone, { type: "tel", inputMode: "numeric", autoComplete: "tel-national", maxLength: 14 })}
        {text("pincode", a.pincode, { inputMode: "numeric", autoComplete: "postal-code", maxLength: 6 })}
        {text("city", a.city, { autoComplete: "address-level2", maxLength: 60 })}
        <div className="small:col-span-2">{text("house", a.house, { autoComplete: "address-line1", maxLength: 120 })}</div>
        <div className="small:col-span-2">{text("area", a.area, { autoComplete: "address-line2", maxLength: 120 })}</div>
        {text("landmark", a.landmark, { maxLength: 80 })}
        <label className="flex flex-col gap-1.5 text-sm">
          {a.state}
          <select className={field} value={value.state} onChange={set("state")} aria-invalid={bad("state")} name="state" autoComplete="address-level1">
            <option value="">{a.selectState}</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-wrap items-center gap-3 text-sm">
        <legend className="mb-2">{a.type}</legend>
        {(["home", "work"] as const).map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={value.type === type}
            onClick={() => setValue((v) => ({ ...v, type }))}
            className={`chip h-9 ${value.type === type ? "chip-active" : ""}`}
          >
            {type === "home" ? a.home : a.work}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2">
          <input type="checkbox" checked={!!value.isDefault} onChange={(e) => setValue((v) => ({ ...v, isDefault: e.target.checked }))} className="h-4 w-4 accent-ink" />
          {t.account.makeDefault}
        </label>
      </fieldset>
      <p role="alert" className="min-h-[1.25rem] text-sm text-danger">
        {message}
      </p>
      <div className="flex gap-3">
        <button type="submit" className="btn-primary flex-1 small:flex-none small:px-10" disabled={pending} data-testid="save-address-button">
          {pending ? t.account.saving : a.saveAddress}
        </button>
        <button type="button" className="btn-outline" onClick={onCancel}>
          {t.account.cancel}
        </button>
      </div>
    </form>
  )
}
