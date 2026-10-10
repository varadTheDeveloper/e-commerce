import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WISHLIST_MODULE } from "../../../../../../modules/wishlist"
import WishlistModuleService from "../../../../../../modules/wishlist/service"
import { listWishlist } from "../helpers"

/** DELETE /store/customers/me/wishlist/:product_id */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const wishlist: WishlistModuleService = req.scope.resolve(WISHLIST_MODULE)
  await wishlist.removeProduct(req.auth_context.actor_id, req.params.product_id)
  res.json({ items: await listWishlist(req.scope, req.auth_context.actor_id) })
}
