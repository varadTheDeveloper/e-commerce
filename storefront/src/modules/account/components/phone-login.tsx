"use client"

import { AuthError, completeSignup, requestLoginCode, verifyLoginCode } from "@lib/data/phone-auth"
import { format } from "@lib/i18n"
import { useI18n } from "@lib/i18n/provider"
import { richFormat } from "@modules/common/components/rich-format"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

type Step = "phone" | "code" | "name"

const VALID_MOBILE = /^[6-9]\d{9}$/

const input =
  "h-12 w-full border border-line bg-white px-4 text-[16px] text-ink placeholder:text-muted focus:border-ink focus:outline-none"

/** Mobile number → SMS code → (first time) name. */
export default function PhoneLogin() {
  const { t, locale } = useI18n()
  // Opens in a new tab, so the login in progress is not lost
  const policyLink = (slug: "privacy" | "terms", label: string) => (
    <a href={`/${locale}/${slug}`} target="_blank" rel="noopener" className="underline underline-offset-2">
      {label}
    </a>
  )
  const router = useRouter()
  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<AuthError | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const [pending, start] = useTransition()
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (resendIn <= 0) return
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendIn])

  useEffect(() => {
    if (step === "code") codeRef.current?.focus()
  }, [step])

  const sendCode = () => {
    setError(null)
    if (!VALID_MOBILE.test(phone)) {
      setError("invalid_phone")
      return
    }
    start(async () => {
      const res = await requestLoginCode(phone)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setCode("")
      setResendIn(res.resendAfter)
      setStep("code")
    })
  }

  const verify = (value = code) => {
    setError(null)
    if (!/^\d{6}$/.test(value)) {
      setError("wrong_code")
      return
    }
    start(async () => {
      const res = await verifyLoginCode(phone, value)
      if (!res.ok) {
        setError(res.error)
        setCode("")
        return
      }
      if (res.isNew) {
        setStep("name")
      } else {
        router.refresh()
      }
    })
  }

  const finish = (form: FormData) => {
    setError(null)
    start(async () => {
      const res = await completeSignup({
        firstName: String(form.get("first_name") ?? ""),
        lastName: String(form.get("last_name") ?? ""),
        email: String(form.get("email") ?? ""),
        consent: form.get("privacy_consent") === "on",
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  const errorText = error ? t.auth.errors[error] : null

  return (
    <div className="mx-auto w-full max-w-sm py-8" data-testid="login-page">
      {step === "phone" && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendCode()
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <h1 className="heading-lg">{t.auth.title}</h1>
            <p className="mt-2 text-sm text-muted">{t.auth.subtitle}</p>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            {t.auth.phoneLabel}
            <span className="flex">
              <span className="flex h-12 items-center border border-r-0 border-line bg-surface px-3 text-[16px] text-muted">+91</span>
              <input
                className={input}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                aria-invalid={error === "invalid_phone"}
                data-testid="phone-input"
                autoFocus
              />
            </span>
          </label>
          <button type="submit" className="btn-primary w-full" disabled={pending} data-testid="send-code-button">
            {pending ? t.auth.sending : t.auth.sendCode}
          </button>
          <p className="text-[13px] leading-relaxed text-muted" data-testid="phone-notice">
            {richFormat(t.auth.phoneNotice, { privacy: policyLink("privacy", t.auth.privacyLink) })}
          </p>
        </form>
      )}

      {step === "code" && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            verify()
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <h1 className="heading-lg">{t.auth.codeLabel}</h1>
            <p className="mt-2 text-sm text-muted">{format(t.auth.codeSentTo, { phone: `+91 ${phone}` })}</p>
          </div>
          <input
            ref={codeRef}
            className={`${input} text-center text-2xl tracking-[0.5em]`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            aria-label={t.auth.codeLabel}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6)
              setCode(v)
              if (v.length === 6) verify(v)
            }}
            data-testid="code-input"
          />
          <button type="submit" className="btn-primary w-full" disabled={pending || code.length !== 6} data-testid="verify-button">
            {pending ? t.auth.verifying : t.auth.verify}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="underline underline-offset-4 disabled:no-underline disabled:text-muted"
              disabled={resendIn > 0 || pending}
              onClick={sendCode}
            >
              {resendIn > 0 ? format(t.auth.resendIn, { seconds: resendIn }) : t.auth.resend}
            </button>
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => {
                setStep("phone")
                setError(null)
              }}
            >
              {t.auth.changeNumber}
            </button>
          </div>
        </form>
      )}

      {step === "name" && (
        <form
          onSubmit={(e) => {
            // Not a form action: React would empty the fields, and the name is lost if the box was not ticked
            e.preventDefault()
            finish(new FormData(e.currentTarget))
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <h1 className="heading-lg">{t.auth.nameTitle}</h1>
            <p className="mt-2 text-sm text-muted">{t.auth.nameSubtitle}</p>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            {t.auth.firstName}
            <input className={input} name="first_name" required maxLength={60} autoComplete="given-name" data-testid="first-name-input" autoFocus />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            {t.auth.lastName}
            <input className={input} name="last_name" maxLength={60} autoComplete="family-name" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            {t.auth.emailOptional}
            <input className={input} name="email" type="email" maxLength={120} autoComplete="email" />
          </label>
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input type="checkbox" name="privacy_consent" className="mt-1 h-4 w-4 shrink-0 accent-ink" data-testid="consent-checkbox" />
            <span>
              {richFormat(t.auth.consent, {
                privacy: policyLink("privacy", t.auth.privacyLink),
                terms: policyLink("terms", t.auth.termsLink),
              })}
            </span>
          </label>
          <button type="submit" className="btn-primary w-full" disabled={pending} data-testid="create-account-button">
            {pending ? t.auth.creating : t.auth.createAccount}
          </button>
        </form>
      )}

      <p role="alert" aria-live="assertive" className="mt-3 min-h-[1.25rem] text-sm text-danger" data-testid="login-error">
        {errorText}
      </p>
    </div>
  )
}
