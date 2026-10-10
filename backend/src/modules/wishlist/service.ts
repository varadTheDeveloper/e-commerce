import { MedusaService } from "@medusajs/framework/utils"
import WishlistItem from "./models/wishlist-item"

export const MAX_WISHLIST_ITEMS = 200

class WishlistModuleService extends MedusaService({ WishlistItem }) {
  /** Adds products the customer has not saved yet; returns how many were added. */
  async addProducts(customerId: string, productIds: string[]): Promise<number> {
    const existing = await this.listWishlistItems({ customer_id: customerId }, { select: ["product_id"], take: MAX_WISHLIST_ITEMS + 1 })
    const have = new Set(existing.map((i) => i.product_id))
    const fresh = [...new Set(productIds)].filter((id) => !have.has(id)).slice(0, Math.max(0, MAX_WISHLIST_ITEMS - have.size))
    if (fresh.length) {
      await this.createWishlistItems(fresh.map((product_id) => ({ customer_id: customerId, product_id })))
    }
    return fresh.length
  }

  async removeProduct(customerId: string, productId: string): Promise<void> {
    const items = await this.listWishlistItems({ customer_id: customerId, product_id: productId }, { select: ["id"] })
    if (items.length) {
      await this.deleteWishlistItems(items.map((i) => i.id))
    }
  }
}

export default WishlistModuleService
