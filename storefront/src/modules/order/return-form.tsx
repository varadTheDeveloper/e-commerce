"use client"

import { createReturn, CreateReturnInput, ReturnError, ReturnInfo, ReturnReason } from "@lib/data/returns"
import { format } from "@lib/i18n"
import { useI18n } from "@lib/i18n/provider"
import { formatINR } from "@lib/util/money"
import { LineDetails } from "@modules/bag/bag-view"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

const REASONS: ReturnReason[] = ["too_small", "too_large", "damaged", "wrong_item", "not_as_shown", "changed_mind", "other"]
const PHOTO_REASONS: ReturnReason[] = ["damaged", "wrong_item"]
const field = "h-11 w-full border border-line bg-white px-3 text-[16px] focus:border-ink focus:outline-none"

type Choice = { checked: boolean; quantity: number; reason: ReturnReason | ""; note: string; size: string }

/** Ask to return items for a refund, or exchange them for another size. */
export default function ReturnForm({ orderId, info, details }: { orderId: string; info: ReturnInfo; details: Record<string, LineDetails> }) {
  const { locale, t } = useI18n()
  const r = t.returns
  const router = useRouter()
  const [type, setType] = useState<"return" | "exchange">("return")
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [method, setMethod] = useState<"upi" | "bank">("upi")
  const [refund, setRefund] = useState({ upi_id: "", account_name: "", account_number: "", ifsc: "" })
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const choice = (id: string): Choice => choices[id] ?? { checked: false, quantity: 1, reason: "", note: "", size: "" }
  const set = (id: string, patch: Partial<Choice>) => setChoices((c) => ({ ...c, [id]: { ...choice(id), ...patch } }))
  const chosen = info.items.filter((i) => i.returnable && choice(i.line_item_id).checked)
  const needsRefundAccount = type === "return" && info.cod

  const errorText = (code: ReturnError | "choose" | "reason" | "size") => (r.errors as Record<string, string>)[code] ?? r.errors.generic

  const upload = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append("photo", file)
      const res = await fetch("/api/returns/photo", { method: "POST", body: form })
      const body = await res.json()
      if (!res.ok || !body.id) throw new Error()
      setPhotos((p) => [...p, { id: body.id, url: body.url }])
    } catch {
      setError(errorText("invalid_photo"))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!chosen.length) return setError(errorText("choose"))
    if (chosen.some((i) => !choice(i.line_item_id).reason)) return setError(errorText("reason"))
    if (type === "exchange" && chosen.some((i) => !choice(i.line_item_id).size)) return setError(errorText("size"))
    if (chosen.some((i) => PHOTO_REASONS.includes(choice(i.line_item_id).reason as ReturnReason)) && !photos.length) {
      return setError(errorText("photo_required"))
    }
    const input: CreateReturnInput = {
      type,
      items: chosen.map((i) => {
        const c = choice(i.line_item_id)
        return {
          line_item_id: i.line_item_id,
          quantity: c.quantity,
          reason: c.reason as ReturnReason,
          note: c.note.trim() || undefined,
          exchange_variant_id: type === "exchange" ? c.size : undefined,
        }
      }),
      photos: photos.map((p) => p.id),
      refund: needsRefundAccount
        ? method === "upi"
          ? { method: "upi", upi_id: refund.upi_id.trim() }
          : { method: "bank", account_name: refund.account_name.trim(), account_number: refund.account_number.trim(), ifsc: refund.ifsc.trim().toUpperCase() }
        : undefined,
    }
    start(async () => {
      const res = await createReturn(orderId, input)
      if (res.ok) router.push(`/${locale}/account/orders/details/${orderId}?return=sent`)
      else setError(errorText(res.error))
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" data-testid="return-form">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-medium">{r.whatToDo}</legend>
        {(["return", "exchange"] as const).map((k) => (
          <label key={k} className={`flex cursor-pointer items-center gap-3 border bg-white p-4 ${type === k ? "border-ink" : "border-line"}`}>
            <input type="radio" name="type" className="h-4 w-4 accent-ink" checked={type === k} onChange={() => setType(k)} data-testid={`type-${k}`} />
            {k === "return" ? r.typeReturn : r.typeExchange}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-medium">{r.chooseItems}</legend>
        {info.items.map((item) => {
          const c = choice(item.line_item_id)
          const d = details[item.line_item_id] ?? {}
          const image = d.image ?? item.thumbnail
          const why = !item.returnable ? (item.reason === "already_requested" ? r.alreadyRequested : item.reason === "exchange_item" ? r.exchangeItem : r.notReturnable) : null
          const sizes = item.exchange_options
          return (
            <div key={item.line_item_id} className={`border bg-white p-4 ${c.checked ? "border-ink" : "border-line"}`} data-testid="return-item">
              <label className={`flex items-center gap-4 ${why ? "opacity-60" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-ink"
                  disabled={!!why}
                  checked={c.checked}
                  onChange={(e) => set(item.line_item_id, { checked: e.target.checked })}
                  data-testid="return-item-check"
                />
                <span className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden bg-surface">
                  {image && <Image src={image} alt="" fill sizes="56px" className="object-cover" />}
                </span>
                <span className="text-sm">
                  <span className="block">{d.title ?? item.title}</span>
                  <span className="text-muted">
                    {item.variant_title} · {formatINR(item.unit_paid)}
                  </span>
                  {why && <span className="block text-[13px] text-muted">{why}</span>}
                </span>
              </label>

              {c.checked && (
                <div className="mt-4 grid gap-3 small:grid-cols-2">
                  {item.quantity > 1 && (
                    <label className="flex flex-col gap-1 text-sm">
                      {r.quantity}
                      <select className={field} value={c.quantity} onChange={(e) => set(item.line_item_id, { quantity: Number(e.target.value) })}>
                        {Array.from({ length: item.quantity }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-sm">
                    {r.reason}
                    <select
                      className={field}
                      value={c.reason}
                      onChange={(e) => set(item.line_item_id, { reason: e.target.value as ReturnReason })}
                      data-testid="return-reason"
                    >
                      <option value="">—</option>
                      {REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {r.reasons[reason]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {type === "exchange" && (
                    <label className="flex flex-col gap-1 text-sm">
                      {r.newSize}
                      {sizes.some((s) => s.in_stock) ? (
                        <select className={field} value={c.size} onChange={(e) => set(item.line_item_id, { size: e.target.value })} data-testid="return-size">
                          <option value="">—</option>
                          {sizes.map((s) => (
                            <option key={s.variant_id} value={s.variant_id} disabled={!s.in_stock}>
                              {s.size}
                              {s.in_stock ? "" : ` (${r.outOfStock})`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[13px] text-muted">{r.noSizes}</span>
                      )}
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-sm small:col-span-2">
                    {r.note}
                    <input className={field} maxLength={500} value={c.note} onChange={(e) => set(item.line_item_id, { note: e.target.value })} />
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </fieldset>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{r.photos}</h2>
        <p className="text-sm text-muted">{r.photosHelp}</p>
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative h-20 w-20 overflow-hidden border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={r.removePhoto}
                className="absolute right-0 top-0 bg-white px-1.5 text-sm"
                onClick={() => setPhotos((all) => all.filter((x) => x.id !== p.id))}
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <button
              type="button"
              className="btn-outline h-20 px-4 text-sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              data-testid="add-photo"
            >
              {uploading ? r.uploading : `+ ${r.addPhoto}`}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            data-testid="photo-input"
          />
        </div>
      </section>

      {type === "return" && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">{r.refundTo}</h2>
          {needsRefundAccount ? (
            <>
              <p className="text-sm text-muted">{r.refundNote}</p>
              <div className="flex gap-3">
                {(["upi", "bank"] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)} className={`chip h-9 ${method === m ? "chip-active" : ""}`}>
                    {m === "upi" ? r.upi : r.bank}
                  </button>
                ))}
              </div>
              {method === "upi" ? (
                <label className="flex flex-col gap-1 text-sm">
                  {r.upi}
                  <input
                    className={field}
                    placeholder={r.upiPlaceholder}
                    autoComplete="off"
                    value={refund.upi_id}
                    onChange={(e) => setRefund({ ...refund, upi_id: e.target.value })}
                    data-testid="refund-upi"
                  />
                </label>
              ) : (
                <div className="grid gap-3 small:grid-cols-3">
                  <label className="flex flex-col gap-1 text-sm">
                    {r.accountName}
                    <input className={field} autoComplete="off" value={refund.account_name} onChange={(e) => setRefund({ ...refund, account_name: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    {r.accountNumber}
                    <input
                      className={field}
                      inputMode="numeric"
                      autoComplete="off"
                      value={refund.account_number}
                      onChange={(e) => setRefund({ ...refund, account_number: e.target.value.replace(/\D/g, "").slice(0, 18) })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    {r.ifsc}
                    <input className={field} autoComplete="off" maxLength={11} value={refund.ifsc} onChange={(e) => setRefund({ ...refund, ifsc: e.target.value.toUpperCase() })} />
                  </label>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">{r.refundOnline}</p>
          )}
        </section>
      )}

      <p className="bg-surface px-4 py-3 text-sm">{r.pickupNote}</p>
      <p role="alert" className={error ? "bg-brand-50 px-4 py-3 text-sm text-danger" : "sr-only"} data-testid="return-error">
        {error}
      </p>
      <button type="submit" className="btn-primary w-full small:w-auto small:self-start small:px-12" disabled={pending || uploading} data-testid="submit-return">
        {pending ? r.sending : r.submit}
      </button>
      {info.window_ends_at && (
        <p className="text-[13px] text-muted">
          {format(r.openUntil, {
            date: new Date(info.window_ends_at).toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }),
          })}
        </p>
      )}
    </form>
  )
}
