"use client"

import { signout } from "@lib/data/customer"
import { useI18n } from "@lib/i18n/provider"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { usePathname } from "next/navigation"

/** Account menu: tabs on phones, sidebar on computers. */
export default function AccountNav() {
  const { locale, t } = useI18n()
  const path = usePathname().slice(locale.length + 1)
  const links = [
    { href: "/account", label: t.account.overview, active: path === "/account" },
    { href: "/account/orders", label: t.account.orders, active: path.startsWith("/account/orders") },
    { href: "/account/addresses", label: t.account.addresses, active: path.startsWith("/account/addresses") },
    { href: "/account/profile", label: t.account.profile, active: path.startsWith("/account/profile") },
    { href: "/wishlist", label: t.wishlist.title, active: false },
  ]
  return (
    <nav aria-label={t.common.account} className="mb-6 small:mb-0">
      <ul className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 small:mx-0 small:flex-col small:gap-0 small:border-0 small:px-0">
        {links.map((l) => (
          <li key={l.href} className="shrink-0">
            <LocalizedClientLink
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={`block whitespace-nowrap border-b-2 px-3 py-3 text-sm small:border-b-0 small:border-l-2 small:px-4 small:py-2.5 ${
                l.active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {l.label}
            </LocalizedClientLink>
          </li>
        ))}
        <li className="shrink-0 small:mt-4">
          <button
            type="button"
            onClick={() => signout(locale)}
            className="block whitespace-nowrap px-3 py-3 text-left text-sm text-muted hover:text-ink small:px-4 small:py-2.5"
            data-testid="logout-button"
          >
            {t.account.logout}
          </button>
        </li>
      </ul>
    </nav>
  )
}
