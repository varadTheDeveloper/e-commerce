"use client"

import { useI18n } from "@lib/i18n/provider"
import { useWishlist } from "@lib/wishlist"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HeartIcon } from "@modules/common/icons/ui"

export default function WishlistLink({ className = "" }: { className?: string }) {
  const { t } = useI18n()
  const { handles } = useWishlist()
  return (
    <LocalizedClientLink
      href="/wishlist"
      className={`relative flex h-10 w-10 items-center justify-center hover:opacity-70 ${className}`}
      aria-label={`${t.wishlist.title} (${handles.length})`}
      data-testid="nav-wishlist-link"
    >
      <HeartIcon size={22} />
      {handles.length > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
          {handles.length}
        </span>
      )}
    </LocalizedClientLink>
  )
}
