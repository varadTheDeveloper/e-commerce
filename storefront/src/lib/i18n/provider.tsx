"use client"

import { createContext, useContext } from "react"
import { Locale } from "./config"
import type { Dictionary } from "./dictionaries/en"

type I18n = { locale: Locale; t: Dictionary }

const I18nContext = createContext<I18n | null>(null)

/** Gives client components the page language and its texts. */
export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale
  dictionary: Dictionary
  children: React.ReactNode
}) {
  return (
    <I18nContext.Provider value={{ locale, t: dictionary }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18n {
  const value = useContext(I18nContext)
  if (!value) {
    throw new Error("useI18n must be used inside <I18nProvider>")
  }
  return value
}
