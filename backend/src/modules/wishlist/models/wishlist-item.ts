import { model } from "@medusajs/framework/utils"

/** One saved product for one customer. */
const WishlistItem = model
  .define("wishlist_item", {
    id: model.id({ prefix: "wli" }).primaryKey(),
    customer_id: model.text(),
    product_id: model.text(),
  })
  .indexes([
    { on: ["customer_id", "product_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["customer_id"] },
  ])

export default WishlistItem
