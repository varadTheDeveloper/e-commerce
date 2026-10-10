import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"
import WishlistModuleService from "../../../../../modules/wishlist/service"
import { listWishlist } from "./helpers"

/** GET /store/customers/me/wishlist */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json({ items: await listWishlist(req.scope, req.auth_context.actor_id) })
}

export type AddToWishlistBody = { product_ids: string[] }

/** POST /store/customers/me/wishlist { product_ids } — save one or more published products. */
export const POST = async (req: AuthenticatedMedusaRequest<AddToWishlistBody>, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { id: req.validatedBody.product_ids, status: "published" },
  })
  const wishlist: WishlistModuleService = req.scope.resolve(WISHLIST_MODULE)
  await wishlist.addProducts(req.auth_context.actor_id, products.map((p) => p.id))
  res.json({ items: await listWishlist(req.scope, req.auth_context.actor_id) })
}
