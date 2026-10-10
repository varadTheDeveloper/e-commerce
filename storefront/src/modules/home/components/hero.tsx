import { Dictionary } from "@lib/i18n"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

type Banner = {
  title: string
  subtitle: string
  cta: string
  href: string
  images: string[]
  tone: "brand" | "festive"
}

const TONES = {
  brand: "from-brand-700 via-brand-600 to-brand-500 text-white",
  festive: "from-[#5b1220] via-[#7a1b2c] to-[#a3412a] text-white",
}

function BannerCard({ banner, priority }: { banner: Banner; priority?: boolean }) {
  return (
    <LocalizedClientLink
      href={banner.href}
      className={`group relative flex min-h-[220px] overflow-hidden rounded-2xl bg-gradient-to-br small:min-h-[340px] ${TONES[banner.tone]}`}
    >
      <div className="relative z-10 flex max-w-[60%] flex-col justify-center gap-3 p-6 small:p-10">
        <h2 className="text-2xl font-bold leading-tight small:text-4xl">{banner.title}</h2>
        <p className="text-sm opacity-90 small:text-lg">{banner.subtitle}</p>
        <span className="mt-2 inline-flex h-11 w-fit items-center rounded-lg bg-accent-500 px-5 font-semibold text-ink transition-colors group-hover:bg-accent-400">
          {banner.cta}
        </span>
      </div>
      <div className="absolute inset-y-0 right-0 flex w-[48%] items-end justify-end gap-2 pr-3 small:pr-8">
        {banner.images.slice(0, 2).map((src, i) => (
          <div
            key={src}
            className={`relative aspect-[4/5] overflow-hidden rounded-xl shadow-2xl ring-4 ring-white/20 ${
              i === 0 ? "mb-6 w-[62%] small:w-[46%]" : "mb-14 hidden w-[42%] small:block"
            }`}
          >
            <Image src={src} alt="" fill priority={priority} sizes="(max-width: 640px) 30vw, 20vw" className="object-cover" />
          </div>
        ))}
      </div>
    </LocalizedClientLink>
  )
}

export default function Hero({
  t,
  heroImages,
  festiveImages,
}: {
  t: Dictionary
  heroImages: string[]
  festiveImages: string[]
}) {
  return (
    <section className="content-container grid gap-4 pt-4 small:grid-cols-[3fr_2fr] small:pt-6">
      <BannerCard
        priority
        banner={{
          title: t.home.heroTitle,
          subtitle: t.home.heroSubtitle,
          cta: t.home.heroCta,
          href: "/store",
          images: heroImages,
          tone: "brand",
        }}
      />
      <BannerCard
        banner={{
          title: t.home.festiveTitle,
          subtitle: t.home.festiveSubtitle,
          cta: t.home.festiveCta,
          href: "/collections/festive",
          images: festiveImages,
          tone: "festive",
        }}
      />
    </section>
  )
}
