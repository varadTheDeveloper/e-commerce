import { Banner } from "@config/banners"
import { Dictionary } from "@lib/i18n"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

/**
 * Phones: one full-width photo with the headline and two buttons.
 * Computers: women and men side by side, each with its own button.
 */
export default function Hero({ t, women, men }: { t: Dictionary; women: Banner; men: Banner }) {
  return (
    <section className="relative" data-testid="hero">
      <div className="grid small:grid-cols-2">
        {[
          { banner: women, label: t.home2.women, cta: t.home2.shopWomen, href: "/categories/women" },
          { banner: men, label: t.home2.men, cta: t.home2.shopMen, href: "/categories/men" },
        ].map(({ banner, label, cta, href }, i) => (
          <LocalizedClientLink
            key={href}
            href={href}
            className={`group relative block aspect-[4/5] overflow-hidden bg-surface small:aspect-auto small:h-[min(86vh,820px)] ${i === 1 ? "hidden small:block" : ""}`}
          >
            <Image
              src={banner.url}
              alt={banner.alt ?? ""}
              fill
              priority={i === 0}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-[1.2s] group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 hidden flex-col items-center gap-4 p-10 text-center text-white small:flex">
              <span className="font-heading text-5xl">{label}</span>
              <span className="border-b border-white pb-1 text-sm tracking-wide">{cta}</span>
            </div>
          </LocalizedClientLink>
        ))}
      </div>

      {/* Phones: headline and buttons over the single photo */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 p-6 pb-8 text-center text-white small:hidden">
        <h1 className="heading-xl">{t.home.heroTitle}</h1>
        <p className="max-w-xs text-sm text-white/85">{t.home.heroSubtitle}</p>
        <div className="pointer-events-auto mt-1 grid w-full max-w-xs grid-cols-2 gap-2">
          <LocalizedClientLink href="/categories/women" className="inline-flex h-11 items-center justify-center bg-white text-sm font-medium text-ink">
            {t.home2.women}
          </LocalizedClientLink>
          <LocalizedClientLink href="/categories/men" className="inline-flex h-11 items-center justify-center border border-white text-sm font-medium text-white">
            {t.home2.men}
          </LocalizedClientLink>
        </div>
      </div>
      {/* Only one of the two headlines is shown (and read out) at a time */}
      <div className="content-container hidden py-12 text-center small:block">
        <h1 className="heading-xl">{t.home.heroTitle}</h1>
        <p className="mt-3 text-muted">{t.home.heroSubtitle}</p>
      </div>
    </section>
  )
}
