"use client"

import { useI18n } from "@lib/i18n/provider"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { BagIcon, GridIcon, HeartIcon, HomeIcon, UserIcon } from "@modules/common/icons/ui"
import { useWishlist } from "@lib/wishlist"
import { usePathname } from "next/navigation"

/** App-style bar at the bottom of the screen on phones. */
export default function BottomNav({ bagCount }: { bagCount: number }) {
  const { locale, t } = useI18n()
  const { handles } = useWishlist()
  const pathname = usePathname()
  const path = pathname.slice(locale.length + 1) || "/"

  const items = [
    { href: "/", label: t.common.home, icon: HomeIcon, active: path === "/" },
    { href: "/store", label: t.common.categories, icon: GridIcon, active: path.startsWith("/store") || path.startsWith("/categories") },
    { href: "/wishlist", label: t.wishlist.title, icon: HeartIcon, active: path.startsWith("/wishlist"), badge: handles.length },
    { href: "/account", label: t.common.account, icon: UserIcon, active: path.startsWith("/account") },
    { href: "/cart", label: t.common.bag, icon: BagIcon, active: path.startsWith("/cart"), badge: bagCount },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur small:hidden"
      aria-label={t.common.menu}
      data-testid="bottom-nav"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon, active, badge }) => (
          <li key={href}>
            <LocalizedClientLink
              href={href}
              // Account and bag pages are personal and heavy; load them only on tap
              prefetch={href === "/account" || href === "/cart" ? false : undefined}
              className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
                active ? "text-ink" : "text-muted"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span className="leading-none">{label}</span>
              {!!badge && (
                <span className="absolute left-1/2 top-1.5 ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold text-white">
                  {badge}
                </span>
              )}
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
