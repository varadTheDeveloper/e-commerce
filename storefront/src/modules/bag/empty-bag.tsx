"use client"

import { useI18n } from "@lib/i18n/provider"
import { useWishlist } from "@lib/wishlist"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { BagIcon } from "@modules/common/icons/ui"

export default function EmptyBag() {
  const { t } = useI18n()
  const { handles } = useWishlist()
  return (
    <div className="content-container flex flex-col items-center gap-4 py-20 text-center" data-testid="empty-cart-message">
      <BagIcon size={48} strokeWidth={1.2} className="text-muted" />
      <h1 className="heading-lg">{t.bag.emptyTitle}</h1>
      <p className="text-muted">{t.bag.emptyText}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <LocalizedClientLink href="/store" className="btn-primary px-10">
          {t.bag.continueShopping}
        </LocalizedClientLink>
        {handles.length > 0 && (
          <LocalizedClientLink href="/wishlist" className="btn-outline px-8">
            {t.bag.seeWishlist}
          </LocalizedClientLink>
        )}
      </div>
    </div>
  )
}
