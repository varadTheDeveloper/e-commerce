"use client"

import { useI18n } from "@lib/i18n/provider"
import { useWishlist } from "@lib/wishlist"
import { HeartIcon } from "@modules/common/icons/ui"

/** Heart toggle. `variant="overlay"` sits on a product picture. */
export default function WishlistButton({
  handle,
  variant = "overlay",
}: {
  handle: string
  variant?: "overlay" | "button"
}) {
  const { t } = useI18n()
  const { has, toggle } = useWishlist()
  const on = has(handle)
  const label = on ? t.wishlist.remove : t.wishlist.add

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggle(handle)
  }

  if (variant === "button") {
    return (
      <button type="button" onClick={onClick} aria-pressed={on} className="btn-outline w-12 px-0" aria-label={label} title={label} data-testid="wishlist-toggle">
        <HeartIcon size={22} fill={on ? "currentColor" : "none"} className={on ? "text-brand-600" : ""} />
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur transition hover:bg-white"
      data-testid="wishlist-toggle"
    >
      <HeartIcon size={19} fill={on ? "currentColor" : "none"} className={on ? "text-brand-600" : "text-ink"} />
    </button>
  )
}
