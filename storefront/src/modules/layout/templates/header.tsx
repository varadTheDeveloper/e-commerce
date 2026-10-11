import { BRAND } from "@config/brand"
import { listCategoryTree } from "@lib/data/catalog"
import { Dictionary, format } from "@lib/i18n"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { SearchIcon, UserIcon } from "@modules/common/icons/ui"
import { Suspense } from "react"
import BagLink from "../components/header/bag-link"
import LanguageSwitcher from "../components/header/language-switcher"
import Logo from "../components/header/logo"
import MobileMenu, { NavCategory } from "../components/header/mobile-menu"
import WishlistLink from "../components/header/wishlist-link"

export async function navCategories(locale: string): Promise<NavCategory[]> {
  const all = await listCategoryTree(locale).catch(() => [])
  return all
    .filter((c) => !c.parent_category_id)
    .map((c) => ({
      handle: c.handle,
      name: c.name,
      children: all
        .filter((child) => child.parent_category_id === c.id)
        .map((child) => ({ handle: child.handle, name: child.name })),
    }))
}

const iconLink = "flex h-10 w-10 items-center justify-center hover:opacity-70"

export default async function Header({ locale, t }: { locale: string; t: Dictionary }) {
  const categories = await navCategories(locale)
  const notices = [
    BRAND.cashOnDelivery ? t.header.cod : null,
    t.header.easyReturns,
    BRAND.freeDeliveryFrom ? format(t.header.freeDelivery, { amount: BRAND.freeDeliveryFrom }) : null,
  ].filter(Boolean)

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:bg-white focus:px-4 focus:py-2"
      >
        {t.common.skipToContent}
      </a>
      <div className="bg-ink text-white">
        <p className="content-container flex h-8 items-center justify-center gap-8 overflow-hidden whitespace-nowrap text-[12px] tracking-wide">
          {notices.map((n, i) => (
            <span key={i} className={i > 0 ? "hidden small:inline" : ""}>
              {n}
            </span>
          ))}
        </p>
      </div>
      <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur">
        <div className="content-container grid h-14 grid-cols-[1fr_auto_1fr] items-center small:h-[72px]">
          <div className="flex items-center">
            <Suspense fallback={<div className="h-10 w-10 small:hidden" />}>
              <MobileMenu categories={categories} />
            </Suspense>
            <LocalizedClientLink href="/search" className={iconLink} aria-label={t.common.search} data-testid="nav-search-link">
              <SearchIcon size={22} />
            </LocalizedClientLink>
          </div>
          <Logo />
          <div className="flex items-center justify-end">
            <Suspense fallback={<div className="h-10 w-16" />}>
              <LanguageSwitcher />
            </Suspense>
            <WishlistLink className="hidden small:flex" />
            <LocalizedClientLink
              href="/account"
              prefetch={false}
              className={`${iconLink} hidden small:flex`}
              aria-label={t.common.account}
              data-testid="nav-account-link"
            >
              <UserIcon size={22} />
            </LocalizedClientLink>
            <Suspense fallback={null}>
              <BagLink t={t} />
            </Suspense>
          </div>
        </div>
        <nav className="hidden small:block" aria-label={t.common.categories}>
          <ul className="content-container flex h-11 items-center justify-center gap-10 text-[14px] tracking-wide">
            <li>
              <LocalizedClientLink href="/collections/new-arrivals" className="flex h-11 items-center border-b border-transparent hover:border-ink">
                {t.home2.newIn}
              </LocalizedClientLink>
            </li>
            {categories.map((cat) => (
              <li key={cat.handle} className="group relative h-full">
                <LocalizedClientLink href={`/categories/${cat.handle}`} className="flex h-full items-center border-b border-transparent group-hover:border-ink">
                  {cat.name}
                </LocalizedClientLink>
                {cat.children.length > 0 && (
                  <div className="invisible absolute left-1/2 top-full z-50 min-w-52 -translate-x-1/2 border border-line bg-white py-3 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    {cat.children.map((child) => (
                      <LocalizedClientLink key={child.handle} href={`/categories/${child.handle}`} className="block px-6 py-2 text-sm hover:text-brand-600">
                        {child.name}
                      </LocalizedClientLink>
                    ))}
                  </div>
                )}
              </li>
            ))}
            <li>
              <LocalizedClientLink href="/collections/festive" className="flex h-11 items-center border-b border-transparent text-brand-600 hover:border-brand-600">
                {t.home.festiveTitle}
              </LocalizedClientLink>
            </li>
          </ul>
        </nav>
      </header>
    </>
  )
}
