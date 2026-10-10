import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"
import WishlistModuleService, { MAX_WISHLIST_ITEMS } from "../../../../../modules/wishlist/service"

/** The customer's saved products, newest first, with their handles. Unpublished or deleted products are left out. */
export async function listWishlist(scope: MedusaContainer, customerId: string) {
  const wishlist: WishlistModuleService = scope.resolve(WISHLIST_MODULE)
  const items = await wishlist.listWishlistItems(
    { customer_id: customerId },
    { select: ["product_id", "created_at"], order: { created_at: "DESC" }, take: MAX_WISHLIST_ITEMS }
  )
  if (!items.length) return []
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { id: items.map((i) => i.product_id), status: "published" },
  })
  const handles = new Map(products.map((p) => [p.id, p.handle]))
  return items.filter((i) => handles.has(i.product_id)).map((i) => ({ product_id: i.product_id, handle: handles.get(i.product_id)! }))
}
