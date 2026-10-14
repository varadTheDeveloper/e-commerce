import { NextRequest, NextResponse } from "next/server"

// Kept in sync with src/lib/i18n/config.ts (the proxy, called middleware before
// Next.js 16, runs before every page, so it stays small and imports no app code).
const LOCALES = ["mr", "hi", "en"]
const DEFAULT_LOCALE = "mr"
const LOCALE_COOKIE = "_store_locale"
const MEDUSA_LOCALE_COOKIE = "_medusa_locale"
const MEDUSA_LOCALE: Record<string, string> = {
  mr: "mr-IN",
  hi: "hi-IN",
  en: "en-IN",
}
const YEAR = 60 * 60 * 24 * 365

/** Picks the visitor's language: saved choice, then browser languages, then Marathi. */
function preferredLocale(request: NextRequest): string {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value
  if (saved && LOCALES.includes(saved)) {
    return saved
  }

  const accepted = (request.headers.get("accept-language") ?? "")
    .split(",")
    .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase())
  return accepted.find((code) => LOCALES.includes(code)) ?? DEFAULT_LOCALE
}

/**
 * Every page lives under /mr, /hi or /en. Visits without a language are sent
 * to the preferred one. The choice is remembered in a cookie, and Medusa's
 * locale cookie is kept in step so carts are created in the same language.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const first = pathname.split("/")[1]?.toLowerCase()

  if (!LOCALES.includes(first)) {
    const url = request.nextUrl.clone()
    url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`
    url.search = search
    return NextResponse.redirect(url, 307)
  }

  const response = NextResponse.next()
  const cookieOptions = { maxAge: YEAR, sameSite: "lax" as const, path: "/" }

  if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
    response.cookies.set(LOCALE_COOKIE, first, cookieOptions)
  }
  if (request.cookies.get(MEDUSA_LOCALE_COOKIE)?.value !== MEDUSA_LOCALE[first]) {
    response.cookies.set(MEDUSA_LOCALE_COOKIE, MEDUSA_LOCALE[first], cookieOptions)
  }
  if (!request.cookies.get("_medusa_cache_id")) {
    response.cookies.set("_medusa_cache_id", crypto.randomUUID(), {
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
      path: "/",
    })
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|svg|jpg|jpeg|gif|webp|ico|txt|xml|json)$).*)",
  ],
}
