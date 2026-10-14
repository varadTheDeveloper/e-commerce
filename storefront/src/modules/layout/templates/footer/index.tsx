import { BRAND } from "@config/brand"
import { Dictionary, format } from "@lib/i18n"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { NavCategory } from "../../components/header/mobile-menu"

export default function Footer({
  t,
  categories,
}: {
  t: Dictionary
  categories: NavCategory[]
}) {
  const help = [
    { href: "/contact", label: t.footer.contactUs },
    { href: "/shipping", label: t.footer.shipping },
    { href: "/returns-policy", label: t.footer.returns },
    { href: "/faq", label: t.footer.faq },
    { href: "/account/orders", label: t.footer.trackOrder },
  ]
  const legal = [
    { href: "/about", label: t.footer.aboutUs },
    { href: "/privacy", label: t.footer.privacy },
    { href: "/terms", label: t.footer.terms },
    { href: "/grievance", label: t.footer.grievance },
  ]

  return (
    <footer className="mt-20 bg-ink pb-20 text-white small:pb-0">
      <div className="content-container grid grid-cols-2 gap-10 py-14 small:grid-cols-4">
        <div className="col-span-2 small:col-span-1">
          <p className="font-heading text-2xl uppercase tracking-[0.22em]">{BRAND.name}</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">{t.footer.about}</p>
        </div>
        <FooterList title={t.footer.shop} links={categories.map((c) => ({ href: `/categories/${c.handle}`, label: c.name }))} />
        <FooterList title={t.footer.help} links={help} />
        <FooterList title={t.footer.legal} links={legal} />
      </div>
      <div className="border-t border-white/15">
        <div className="content-container flex flex-col gap-2 py-5 text-xs text-white/60 small:flex-row small:justify-between">
          <p>{format(t.footer.rights, { year: new Date().getFullYear(), brand: BRAND.name })}</p>
          <span className="flex gap-5">
            <LocalizedClientLink href="/credits" className="hover:text-white">
              {t.credits.title}
            </LocalizedClientLink>
            <a href={BRAND.sourceCodeUrl} className="hover:text-white" rel="noopener">
              {t.footer.sourceCode}
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}

function FooterList({ title, links }: { title: string; links: { href?: string; label: string }[] }) {
  return (
    <div>
      <p className="eyebrow mb-4 text-white/50">{title}</p>
      <ul className="space-y-2.5 text-sm text-white/80">
        {links.map((l) => (
          <li key={l.label}>
            {l.href ? (
              <LocalizedClientLink href={l.href} className="hover:text-white">
                {l.label}
              </LocalizedClientLink>
            ) : (
              <span>{l.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
