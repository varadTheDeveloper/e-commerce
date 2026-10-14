import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { PRIVACY_VERSION } from "../../../../config/privacy"
import { createPhoneCustomerWorkflow } from "../../../../workflows/create-phone-customer"

export type OtpAccountBody = { first_name: string; last_name?: string; email?: string; privacy_consent: true }

/**
 * POST /store/otp/account — creates the customer for a phone that was just
 * verified (bearer token from /auth/customer/phone-otp). The phone number
 * comes from the verified identity, never from the request body.
 */
export const POST = async (req: AuthenticatedMedusaRequest<OtpAccountBody>, res: MedusaResponse) => {
  if (req.auth_context.actor_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "This number already has an account.")
  }
  const auth = req.scope.resolve(Modules.AUTH)
  const identity = await auth.retrieveAuthIdentity(req.auth_context.auth_identity_id, {
    relations: ["provider_identities"],
  })
  const phone = identity.provider_identities?.find((p) => p.provider === "phone-otp")?.entity_id
  if (!phone) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Log in with your phone number first.")
  }

  const { first_name, last_name, email } = req.validatedBody
  const { result } = await createPhoneCustomerWorkflow(req.scope).run({
    input: {
      authIdentityId: identity.id,
      customerData: {
        phone,
        first_name,
        last_name: last_name || null,
        email: email || null,
        // What they agreed to, and when (DPDP Act: consent must be provable)
        metadata: { privacy_consent: { version: PRIVACY_VERSION, at: new Date().toISOString() } },
      },
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "first_name", "last_name", "phone", "email"],
    filters: { id: result.id },
  })
  res.status(201).json({ customer: data[0] })
}
