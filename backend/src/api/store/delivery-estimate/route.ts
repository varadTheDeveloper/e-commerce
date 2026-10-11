import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { RateLimiter } from "../../../lib/rate-limit"
import { deliveryEstimate } from "../../../lib/shiprocket"

const PINCODE = /^[1-9]\d{5}$/
// Each check may call Shiprocket: at most 60 per network address per 15 minutes
// (more against the fake Shiprocket used by tests)
const perIp = new RateLimiter(process.env.SHIPROCKET_API_BASE ? 1000 : 60, 15 * 60 * 1000)

/** GET /store/delivery-estimate?pincode=431203 — can we deliver there, with COD, and by when. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const pincode = String(req.query.pincode ?? "").trim()
  if (!PINCODE.test(pincode)) {
    return res.status(400).json({ type: "invalid_data", message: "Enter a valid 6-digit pincode" })
  }
  const wait = perIp.hit(req.ip ?? "unknown")
  if (wait) {
    return res.status(429).json({ type: "too_many", message: "Too many requests. Try again later.", retry_after: Math.ceil(wait / 1000) })
  }
  try {
    res.json(await deliveryEstimate(pincode))
  } catch (e) {
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).warn(`Delivery estimate failed: ${e instanceof Error ? e.message : e}`)
    // Shiprocket unreachable: let the customer go on; the courier booking will tell staff
    res.json({ serviceable: true, cod: true, date: null, checked: false })
  }
}
