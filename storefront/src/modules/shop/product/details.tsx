import { Dictionary } from "@lib/i18n"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ChevronDownIcon } from "@modules/common/icons/ui"

function Section({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[15px] [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDownIcon size={18} strokeWidth={1.5} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 text-sm leading-relaxed text-muted">{children}</div>
    </details>
  )
}

/** Product facts. Country of origin is required on Indian e-commerce listings. */
export default function ProductDetails({ product, t }: { product: HttpTypes.StoreProduct; t: Dictionary }) {
  const meta = (product.metadata ?? {}) as Record<string, unknown>
  const fit = t.product.fits[meta.fit as keyof typeof t.product.fits]
  const care = t.product.cares[meta.care as keyof typeof t.product.cares]
  const originCode = (meta.country_of_origin as string) ?? product.origin_country?.toUpperCase()
  const origin = originCode ? t.product.countries[originCode as keyof typeof t.product.countries] ?? originCode : undefined

  const rows = [
    product.material && { label: t.product.fabric, value: product.material },
    fit && { label: t.product.fit, value: fit },
    care && { label: t.product.care, value: care },
    origin && { label: t.product.countryOfOrigin, value: origin },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div className="border-t border-line" data-testid="product-details">
      <Section title={t.product.details} open>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-ink">{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      </Section>
      {product.description && (
        <Section title={t.product.description}>
          <p className="whitespace-pre-line">{product.description}</p>
        </Section>
      )}
      <Section title={t.product.returns}>
        <p>{t.product.returnsText}</p>
        <LocalizedClientLink href="/returns-policy" className="mt-2 inline-block text-ink underline underline-offset-4" data-testid="returns-policy-link">
          {t.product.returnsPolicy}
        </LocalizedClientLink>
      </Section>
    </div>
  )
}
