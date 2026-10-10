import { authenticate, defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

export const OtpRequestSchema = z.object({ phone: z.string().min(10).max(20) })

export const OtpAccountSchema = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().max(60).optional(),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
})

export default defineMiddlewares({
  routes: [
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
