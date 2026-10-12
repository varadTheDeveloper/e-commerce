import { BRAND } from "@config/brand"
import { toLocale } from "@lib/i18n/config"
import { getDictionary } from "@lib/i18n"
import { I18nProvider } from "@lib/i18n/provider"
import { getBaseURL } from "@lib/util/env"
import { Metadata, Viewport } from "next"
import { Mukta, Tiro_Devanagari_Marathi } from "next/font/google"
import "styles/globals.css"

// Mukta covers Devanagari (Marathi, Hindi) and Latin in one family.
// Not preloaded: with preloading, phones fetched all 10 font files (~415 KB) before
// anything else. Without it the browser fetches only the weights and scripts a page
// uses (English pages skip the Devanagari files), showing text in a fallback meanwhile.
const mukta = Mukta({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
  variable: "--font-sans",
})

// Elegant serif for headings, with Devanagari and Latin letters.
const tiro = Tiro_Devanagari_Marathi({
  subsets: ["devanagari", "latin"],
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-heading",
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: { default: BRAND.name, template: `%s | ${BRAND.name}` },
}

export const viewport: Viewport = {
  themeColor: "#1c1b19",
}

export default async function LocaleLayout(props: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const locale = toLocale((await props.params).locale)

  return (
    <html lang={locale} data-mode="light" className={`${mukta.variable} ${tiro.variable}`}>
      <body className="bg-cream font-sans text-ink antialiased">
        <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
          {props.children}
        </I18nProvider>
      </body>
    </html>
  )
}
