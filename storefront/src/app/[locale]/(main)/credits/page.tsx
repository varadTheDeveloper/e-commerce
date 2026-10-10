import { BANNERS } from "@config/banners"
import { listProductsFor } from "@lib/data/catalog"
import { getDictionary } from "@lib/i18n"
import { toLocale } from "@lib/i18n/config"
import { Metadata } from "next"
import Image from "next/image"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: t.credits.title, robots: { index: false } }
}

type Credit = { url: string; name: string; profile: string; photo: string }

/** Unsplash asks apps to credit photographers; demo photos carry their credits. */
export default async function CreditsPage(props: Props) {
  const locale = toLocale((await props.params).locale)
  const t = getDictionary(locale)
  const products = await listProductsFor(locale).catch(() => [])

  const credits: Credit[] = [
    ...Object.values(BANNERS).map((b) => ({ url: b.url, ...b.credit })),
    ...products.flatMap((p) =>
      (p.images ?? []).flatMap((img) => {
        const m = img.metadata ?? {}
        return typeof m.credit_name === "string"
          ? [{ url: img.url, name: m.credit_name, profile: String(m.credit_profile), photo: String(m.credit_photo) }]
          : []
      })
    ),
  ]
  const unique = [...new Map(credits.map((c) => [c.photo, c])).values()]
  // "Photo by {name} on Unsplash": text around the linked name
  const [before, after = ""] = t.credits.by.split("{name}")

  return (
    <div className="content-container py-8 small:py-12">
      <h1 className="heading-lg">{t.credits.title}</h1>
      <p className="mt-3 max-w-xl text-muted">{t.credits.intro}</p>
      <ul className="mt-8 grid grid-cols-3 gap-3 small:grid-cols-6">
        {unique.map((c) => (
          <li key={c.photo}>
            <a href={c.photo} rel="noopener" className="relative block aspect-[4/5] bg-surface">
              <Image src={c.url} alt="" fill sizes="160px" className="object-cover" />
            </a>
            <p className="mt-1.5 text-[11px] leading-snug text-muted">
              {before}
              <a href={c.profile} rel="noopener" className="underline">
                {c.name}
              </a>
              {after}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
