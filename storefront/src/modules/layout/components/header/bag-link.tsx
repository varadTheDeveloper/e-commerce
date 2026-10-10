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
      className="relative flex h-10 w-10 items-center justify-center hover:opacity-70"
      data-testid="nav-cart-link"
      aria-label={`${t.common.bag} (${count})`}
    >
      <BagIcon size={22} />
      {count > 0 && (
        <span
          className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold text-white"
          data-testid="bag-count"
        >
          {count}
        </span>
      )}
    </LocalizedClientLink>
  )
}
