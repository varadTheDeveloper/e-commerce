import { Locale } from "@lib/i18n/config"

/** "2026-10-15" → "Thu, 15 Oct" in the page language (Indian calendar style). */
export function shortDate(isoDate: string, locale: Locale): string {
  const d = new Date(`${isoDate}T12:00:00+05:30`)
  return d.toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" })
}
