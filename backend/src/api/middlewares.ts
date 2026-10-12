import { authenticate, defineMiddlewares, MedusaNextFunction, MedusaRequest, MedusaResponse, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import multer from "multer"
import { CANCEL_REASONS } from "../lib/cancel"
import { RateLimiter } from "../lib/rate-limit"
import { RETURN_REASONS } from "../lib/returns"

export const OtpRequestSchema = z.object({ phone: z.string().min(10).max(20) })

export const OtpAccountSchema = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().max(60).optional(),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  /** Ticked "I am 18 or older and agree to the privacy policy and terms" */
  privacy_consent: z.literal(true, { message: "Please agree to the privacy policy." }),
})

export const AddToWishlistSchema = z.object({
  product_ids: z.array(z.string().min(1).max(100)).min(1).max(200),
})

export const CodRequestSchema = z.object({ cart_id: z.string().min(1).max(100) })
export const CodConfirmSchema = z.object({ cart_id: z.string().min(1).max(100), code: z.string().regex(/^\d{6}$/).optional() })

export const CancelOrderSchema = z.object({
  reason: z.enum(CANCEL_REASONS),
})

const RefundSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("upi"), upi_id: z.string().trim().min(3).max(100) }),
  z.object({
    method: z.literal("bank"),
    account_name: z.string().trim().min(2).max(100),
    account_number: z.string().trim().max(20),
    ifsc: z.string().trim().toUpperCase().length(11),
  }),
])

export const CreateReturnSchema = z.object({
  type: z.enum(["return", "exchange"]),
  items: z
    .array(
      z.object({
        line_item_id: z.string().min(1).max(100),
        quantity: z.number().int().min(1).max(50),
        reason: z.enum(RETURN_REASONS),
        note: z.string().max(500).optional(),
        exchange_variant_id: z.string().max(100).optional(),
      })
    )
    .min(1)
    .max(50),
  photos: z.array(z.string().max(300)).max(3).optional(),
  refund: RefundSchema.optional(),
})

// Return photos: one per request, kept in memory, at most 5 MB
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } })

// Staff login: after 10 wrong passwords for one email from one address in 15 minutes,
// wait. Only failures count, so staff who type the right password are never slowed.
const staffLoginFailures = new RateLimiter(10, 15 * 60 * 1000)
function limitStaffLogin(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const email = String((req.body as { email?: unknown } | undefined)?.email ?? "").toLowerCase()
  const key = `${req.ip ?? "unknown"}|${email}`
  const wait = staffLoginFailures.check(key)
  if (wait) {
    res.status(429).json({ type: "too_many", message: "Too many wrong passwords. Please try again later.", retry_after: Math.ceil(wait / 1000) })
    return
  }
  res.on("finish", () => {
    if (res.statusCode === 401) staffLoginFailures.hit(key)
  })
  next()
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/auth/user/emailpass",
      method: ["POST"],
      middlewares: [limitStaffLogin],
    },
    {
      matcher: "/store/customers/me/delete",
      method: ["POST"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/customers/me/wishlist*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/customers/me/wishlist",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AddToWishlistSchema)],
    },
    {
      matcher: "/admin/return-requests/:id/reject",
      method: ["POST"],
      middlewares: [validateAndTransformBody(z.object({ reason: z.string().trim().min(3).max(300) }))],
    },
    {
      matcher: "/admin/return-requests/:id/refunded",
      method: ["POST"],
      middlewares: [validateAndTransformBody(z.object({ reference: z.string().trim().min(3).max(100) }))],
    },
    {
      matcher: "/store/orders/:id/returns",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/orders/:id/returns",
      method: ["POST"],
      middlewares: [validateAndTransformBody(CreateReturnSchema)],
    },
    {
      matcher: "/store/returns/photos",
      method: ["POST"],
      middlewares: [authenticate("customer", ["session", "bearer"]), photoUpload.single("photo") as any],
    },
    {
      matcher: "/store/orders/:id/tracking",
      method: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/orders/:id/invoice",
      method: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/orders/:id/cancel",
      method: ["POST"],
      middlewares: [authenticate("customer", ["session", "bearer"]), validateAndTransformBody(CancelOrderSchema)],
    },
    {
      matcher: "/store/cod*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/cod/request",
      method: ["POST"],
      middlewares: [validateAndTransformBody(CodRequestSchema)],
    },
    {
      matcher: "/store/cod/confirm",
      method: ["POST"],
      middlewares: [validateAndTransformBody(CodConfirmSchema)],
    },
    {
      matcher: "/store/otp/request",
      method: ["POST"],
      middlewares: [validateAndTransformBody(OtpRequestSchema)],
    },
    {
      matcher: "/store/otp/account",
      method: ["POST"],
      middlewares: [
        authenticate("customer", ["bearer"], { allowUnregistered: true }),
        validateAndTransformBody(OtpAccountSchema),
      ],
    },
  ],
})
