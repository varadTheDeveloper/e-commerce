"use client"

import { LOCALES, LOCALE_NAMES } from "@lib/i18n/config"
import { useI18n } from "@lib/i18n/provider"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ChevronRightIcon, CloseIcon, MenuIcon } from "@modules/common/icons/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useLocaleHref } from "./language-switcher"

export type NavCategory = {
  handle: string
  name: string
  children: { handle: string; name: string }[]
}

/** Slide-in menu for phones: categories and language. */
export default function MobileMenu({ categories }: { categories: NavCategory[] }) {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const hrefFor = useLocaleHref()

  // Close when the page changes
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center hover:opacity-70 small:hidden"
        aria-label={t.common.menu}
        aria-expanded={open}
        data-testid="mobile-menu-button"
      >
        <MenuIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] small:hidden" role="dialog" aria-modal="true" aria-label={t.common.menu}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 h-14">
              <span className="font-heading text-xl">{t.common.categories}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center hover:opacity-70"
                aria-label={t.common.close}
              >
                <CloseIcon />
              </button>
            </div>

            <ul className="flex-1 py-2">
              {categories.map((cat) => (
                <li key={cat.handle} className="border-b border-line/60">
                  <LocalizedClientLink
                    href={`/categories/${cat.handle}`}
                    className="flex items-center justify-between px-4 py-3.5 text-base font-medium"
                  >
                    {cat.name}
                    <ChevronRightIcon size={18} className="text-muted" />
                  </LocalizedClientLink>
                  {cat.children.length > 0 && (
                    <ul className="flex flex-wrap gap-2 px-4 pb-4">
                      {cat.children.map((child) => (
                        <li key={child.handle}>
                          <LocalizedClientLink
                            href={`/categories/${child.handle}`}
                            className="chip h-9 text-[13px]"
                          >
                            {child.name}
                          </LocalizedClientLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>

            <div className="border-t border-line p-4">
              <p className="mb-2 text-sm text-muted">{t.common.language}</p>
              <div className="flex gap-2">
                {LOCALES.map((code) => (
                  <Link
                    key={code}
                    href={hrefFor(code)}
                    lang={code}
                    className={`chip flex-1 ${code === locale ? "chip-active" : ""}`}
                  >
                    {LOCALE_NAMES[code]}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
