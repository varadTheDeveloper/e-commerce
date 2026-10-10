"use client"

import { LOCALES, LOCALE_NAMES } from "@lib/i18n/config"
import { useI18n } from "@lib/i18n/provider"
import { GlobeIcon, CheckIcon } from "@modules/common/icons/ui"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

/** Same page in another language: swaps the first part of the address. */
export function useLocaleHref() {
  const pathname = usePathname()
  const search = useSearchParams()?.toString()
  return (target: string) => {
    const rest = pathname.split("/").slice(2).join("/")
    return `/${target}${rest ? `/${rest}` : ""}${search ? `?${search}` : ""}`
  }
}

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n()
  const hrefFor = useLocaleHref()

  return (
    <details className={`group relative ${className}`}>
      <summary
        className="flex h-10 cursor-pointer list-none items-center gap-1.5 px-1.5 text-sm text-ink hover:opacity-70 [&::-webkit-details-marker]:hidden"
        data-testid="language-switcher"
      >
        <GlobeIcon size={20} />
        <span className="sr-only">{t.common.language}: </span>
        <span>{LOCALE_NAMES[locale]}</span>
      </summary>
      <ul className="absolute right-0 z-50 mt-1 w-40 overflow-hidden border border-line bg-white py-1 shadow-lg">
        {LOCALES.map((code) => (
          <li key={code}>
            <Link
              href={hrefFor(code)}
              hrefLang={code}
              lang={code}
              className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-surface"
              aria-current={code === locale ? "true" : undefined}
              data-testid={`language-${code}`}
            >
              {LOCALE_NAMES[code]}
              {code === locale && <CheckIcon size={16} />}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  )
}
