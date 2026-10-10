import { BRAND } from "@config/brand"
import { listCategoryTree } from "@lib/data/catalog"
import { Dictionary, format } from "@lib/i18n"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { UserIcon } from "@modules/common/icons/ui"
import { Suspense } from "react"
import BagLink from "../components/header/bag-link"
import LanguageSwitcher from "../components/header/language-switcher"
import Logo from "../components/header/logo"
import MobileMenu, { NavCategory } from "../components/header/mobile-menu"
import SearchBox from "../components/header/search-box"

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

export default async function Header({ locale, t }: { locale: string; t: Dictionary }) {
  const categories = await navCategories(locale)
  const notices = [
    BRAND.cashOnDelivery ? t.header.cod : null,
    t.header.easyReturns,
    BRAND.freeDeliveryAbove ? format(t.header.freeDelivery, { amount: BRAND.freeDeliveryAbove }) : null,
  ].filter(Boolean)

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded focus:bg-white focus:px-4 focus:py-2"
      >
        {t.common.skipToContent}
      </a>
      <div className="bg-brand-700 text-white">
        <p className="content-container flex h-8 items-center justify-center gap-6 overflow-hidden whitespace-nowrap text-[12.5px]">
          {notices.map((n, i) => (
            <span key={i} className={i > 0 ? "hidden small:inline" : ""}>
              {n}
            </span>
          ))}
        </p>
      </div>
      <header className="sticky top-0 z-50 border-b border-line bg-white">
        <div className="content-container flex h-16 items-center gap-2 small:gap-6">
          <Suspense fallback={<div className="h-10 w-10 small:hidden" />}>
            <MobileMenu categories={categories} />
          </Suspense>
          <Logo />
          <SearchBox locale={locale} t={t} id="search-desktop" className="mx-4 hidden max-w-xl flex-1 small:block" />
          <div className="ml-auto flex items-center gap-1">
            <Suspense fallback={<div className="h-10 w-24" />}>
              <LanguageSwitcher />
            </Suspense>
            <LocalizedClientLink
              href="/account"
              prefetch={false}
              className="hidden h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium hover:bg-surface small:flex"
              data-testid="nav-account-link"
            >
              <UserIcon size={22} />
              {t.common.account}
            </LocalizedClientLink>
            <Suspense fallback={null}>
              <BagLink t={t} />
            </Suspense>
          </div>
        </div>
        <div className="content-container pb-3 small:hidden">
          <SearchBox locale={locale} t={t} id="search-mobile" />
        </div>
        <nav className="hidden border-t border-line small:block" aria-label={t.common.categories}>
          <ul className="content-container flex h-11 items-center gap-8 text-[15px] font-medium">
            {categories.map((cat) => (
              <li key={cat.handle} className="group relative h-full">
                <LocalizedClientLink
                  href={`/categories/${cat.handle}`}
                  className="flex h-full items-center border-b-2 border-transparent group-hover:border-brand-600 group-hover:text-brand-700"
                >
                  {cat.name}
                </LocalizedClientLink>
                {cat.children.length > 0 && (
                  <div className="invisible absolute left-0 top-full z-50 min-w-52 rounded-b-lg border border-line bg-white py-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    {cat.children.map((child) => (
                      <LocalizedClientLink
                        key={child.handle}
                        href={`/categories/${child.handle}`}
                        className="block px-4 py-2 text-sm hover:bg-surface hover:text-brand-700"
                      >
                        {child.name}
                      </LocalizedClientLink>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </header>
    </>
  )
}
