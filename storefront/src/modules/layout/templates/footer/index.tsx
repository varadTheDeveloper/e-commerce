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
  // Help and legal pages are written in Step 7. Until then they show as plain text, not dead links.
  const help = [
    { label: t.footer.contactUs },
    { label: t.footer.shipping },
    { label: t.footer.returns },
    { label: t.footer.faq },
    { href: "/account/orders", label: t.footer.trackOrder },
  ]
  const legal = [{ label: t.footer.privacy }, { label: t.footer.terms }, { label: t.footer.grievance }]

  return (
    <footer className="mt-16 border-t border-line bg-surface pb-20 small:pb-0">
      <div className="content-container grid grid-cols-2 gap-8 py-12 small:grid-cols-4">
        <div className="col-span-2 small:col-span-1">
          <p className="text-xl font-bold text-brand-700">{BRAND.name}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">{t.footer.about}</p>
        </div>
        <FooterList title={t.footer.shop} links={categories.map((c) => ({ href: `/categories/${c.handle}`, label: c.name }))} />
        <FooterList title={t.footer.help} links={help} />
        <FooterList title={t.footer.legal} links={legal} />
      </div>
      <div className="border-t border-line">
        <div className="content-container flex flex-col gap-2 py-5 text-xs text-muted small:flex-row small:justify-between">
          <p>{format(t.footer.rights, { year: new Date().getFullYear(), brand: BRAND.name })}</p>
          <a href={BRAND.sourceCodeUrl} className="hover:text-ink" rel="noopener">
            {t.footer.sourceCode}
          </a>
        </div>
      </div>
    </footer>
  )
}

function FooterList({ title, links }: { title: string; links: { href?: string; label: string }[] }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink">{title}</p>
      <ul className="space-y-2.5 text-sm text-muted">
        {links.map((l) => (
          <li key={l.label}>
            {l.href ? (
              <LocalizedClientLink href={l.href} className="hover:text-brand-700">
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
