export const LOCALES = ["mr", "hi", "en"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "mr"

/** Locale codes used by Medusa's translation module */
export const MEDUSA_LOCALE: Record<Locale, string> = {
  mr: "mr-IN",
  hi: "hi-IN",
  en: "en-IN",
}

/** Names shown in the language switcher, each in its own language */
export const LOCALE_NAMES: Record<Locale, string> = {
  mr: "मराठी",
  hi: "हिंदी",
  en: "English",
}

export const LOCALE_COOKIE = "_store_locale"

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}

export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/** Header that makes Medusa return product/category text in this language */
export function localeHeader(locale: string): { "x-medusa-locale": string } {
  return { "x-medusa-locale": MEDUSA_LOCALE[toLocale(locale)] }
}
