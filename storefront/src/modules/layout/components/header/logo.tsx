import { BRAND } from "@config/brand"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/** Text logo until the brand sends its own artwork. */
export default function Logo() {
  return (
    <LocalizedClientLink
      href="/"
      className="flex items-center gap-1.5 text-[22px] font-bold leading-none tracking-tight text-brand-700"
      data-testid="nav-store-link"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-base text-white">
        {BRAND.name.charAt(0)}
      </span>
      {BRAND.name}
    </LocalizedClientLink>
  )
}
