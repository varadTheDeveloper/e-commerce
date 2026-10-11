import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHOP } from "../../../config/shop"

/** GET /store/shop-settings — checkout rules the shop shows to customers. */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.json({
    free_shipping_from: SHOP.freeShippingFrom,
    shipping_fee: SHOP.shippingFee,
    cod_max_order: SHOP.codMaxOrder,
  })
}
