import { Banner } from "@config/banners"
import { Dictionary } from "@lib/i18n"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

export default function FestiveBand({ t, banner }: { t: Dictionary; banner: Banner }) {
  return (
    <section className="bg-brand-700 text-white">
      <div className="grid small:grid-cols-2">
        <div className="relative aspect-[4/5] small:aspect-auto small:min-h-[640px]">
          <Image src={banner.url} alt={banner.alt ?? ""} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
        </div>
        <div className="flex flex-col items-start justify-center gap-5 px-6 py-12 small:px-16">
          <span className="eyebrow text-accent-400">{t.home.festivePicks}</span>
          <h2 className="heading-xl">{t.home.festiveTitle}</h2>
          <p className="max-w-sm text-white/80">{t.home.festiveSubtitle}</p>
          <LocalizedClientLink href="/collections/festive" className="mt-2 inline-flex h-12 items-center bg-white px-8 text-[15px] font-medium text-ink hover:bg-cream">
            {t.home.festiveCta}
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}
