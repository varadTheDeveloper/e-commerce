import { authenticate, defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

export const OtpRequestSchema = z.object({ phone: z.string().min(10).max(20) })

export const OtpAccountSchema = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().max(60).optional(),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
})

export const AddToWishlistSchema = z.object({
  product_ids: z.array(z.string().min(1).max(100)).min(1).max(200),
})

export const CodRequestSchema = z.object({ cart_id: z.string().min(1).max(100) })
export const CodConfirmSchema = z.object({ cart_id: z.string().min(1).max(100), code: z.string().regex(/^\d{6}$/).optional() })

export default defineMiddlewares({
  routes: [
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
      matcher: "/store/orders/:id/invoice",
      method: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
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
