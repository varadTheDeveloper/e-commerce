import { BRAND } from "@config/brand"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/** Text logo until the brand sends its own artwork. */
export default function Logo() {
  return (
    <LocalizedClientLink
      href="/"
      className="font-heading text-[26px] uppercase leading-none tracking-[0.22em] text-ink small:text-[30px]"
      data-testid="nav-store-link"
    >
      {BRAND.name}
    </LocalizedClientLink>
  )
}
