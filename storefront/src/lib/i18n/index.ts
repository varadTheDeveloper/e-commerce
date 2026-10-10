import { Locale, toLocale } from "./config"
import en, { Dictionary } from "./dictionaries/en"
import hi from "./dictionaries/hi"
import mr from "./dictionaries/mr"

export type { Dictionary }

const DICTIONARIES: Record<Locale, Dictionary> = { en, hi, mr }

export function getDictionary(locale: string): Dictionary {
  return DICTIONARIES[toLocale(locale)]
}

/** Fills {name} placeholders: format("Only {count} left", { count: 3 }) */
export function format(
  template: string,
  values: Record<string, string | number> = {}
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match
  )
}
