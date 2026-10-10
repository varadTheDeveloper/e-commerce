import { retrieveCart } from "@lib/data/cart"
import { Dictionary } from "@lib/i18n"
import { BagIcon } from "@modules/common/icons/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export async function bagCount(): Promise<number> {
  const cart = await retrieveCart().catch(() => null)
  return cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0
}

export default async function BagLink({ t }: { t: Dictionary }) {
  const count = await bagCount()
  return (
    <LocalizedClientLink
      href="/cart"
      prefetch={false}
      className="relative flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium hover:bg-surface"
      data-testid="nav-cart-link"
      aria-label={`${t.common.bag} (${count})`}
    >
      <BagIcon size={22} />
      <span className="hidden small:inline">{t.common.bag}</span>
      {count > 0 && (
        <span
          className="absolute -top-0.5 left-5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-ink"
          data-testid="bag-count"
        >
          {count}
        </span>
      )}
    </LocalizedClientLink>
  )
}
