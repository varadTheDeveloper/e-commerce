"use client"

import { useI18n } from "@lib/i18n/provider"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function NotFound() {
  const { t } = useI18n()
  return (
    <div className="content-container flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-6xl font-semibold text-brand-200">404</p>
      <h1 className="text-2xl font-semibold">{t.notFound.title}</h1>
      <p className="text-muted">{t.notFound.text}</p>
      <LocalizedClientLink href="/" className="btn-primary mt-2">
        {t.notFound.cta}
      </LocalizedClientLink>
    </div>
  )
}
