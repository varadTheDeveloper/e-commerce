import { getDictionary } from "@lib/i18n"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Logo from "@modules/layout/components/header/logo"

/** Checkout: a quiet header (no menus) so customers can finish without distraction. */
export default async function CheckoutLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const t = getDictionary((await props.params).locale)
  return (
    <div className="min-h-screen w-full">
      <header className="border-b border-line bg-white">
        <nav className="content-container flex h-16 items-center justify-between">
          <LocalizedClientLink
            href="/cart"
            prefetch={false}
            aria-label={t.checkout.backToBag}
            className="flex flex-1 basis-0 items-center gap-2 text-sm"
            data-testid="back-to-cart-link"
          >
            <span aria-hidden>←</span>
            <span className="hidden small:inline">{t.checkout.backToBag}</span>
          </LocalizedClientLink>
          <Logo />
          <p className="flex flex-1 basis-0 items-center justify-end gap-1.5 text-[13px] text-muted">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="4" y="10" width="16" height="11" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <span className="hidden small:inline">{t.checkout.secure}</span>
          </p>
        </nav>
      </header>
      <main id="main" data-testid="checkout-container">
        {props.children}
      </main>
    </div>
  )
}

// Personal pages: always rendered per request, never pre-built.
export const dynamic = "force-dynamic"
