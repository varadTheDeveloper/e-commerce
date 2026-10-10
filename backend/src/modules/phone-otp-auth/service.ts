import {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
  Logger,
} from "@medusajs/framework/types"
import { AbstractAuthModuleProvider, MedusaError } from "@medusajs/framework/utils"
import { canSendOtp, issuedState, OtpState, verifyOtp } from "../../lib/otp"
import { normalizeIndianMobile } from "../../lib/phone"

type Options = {
  /** HMAC secret for login codes (OTP_SECRET) */
  secret: string
}

const GENERIC_ERROR = "Invalid or expired code"

/**
 * Passwordless login with a code sent by SMS.
 *
 * - `update({ entity_id: phone, code_hash })` (called by POST /store/otp/request)
 *   creates the identity on first use and stores the hashed code, enforcing
 *   the resend wait and the hourly cap.
 * - `authenticate({ body: { phone, code } })` (POST /auth/customer/phone-otp)
 *   checks the code, counts wrong tries, and clears it after use.
 * The identity's entity_id is the phone number in +91XXXXXXXXXX form.
 */
class PhoneOtpAuthService extends AbstractAuthModuleProvider {
  static identifier = "phone-otp"
  static DISPLAY_NAME = "Phone OTP"

  protected options_: Options
  protected logger_: Logger

  static validateOptions(options: Record<string, unknown>) {
    if (typeof options.secret !== "string" || options.secret.length < 16) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "phone-otp: option 'secret' (OTP_SECRET) is required")
    }
  }

  constructor({ logger }: { logger: Logger }, options: Options) {
    // Same pattern as Medusa's own providers: the base class reads the container itself
    // @ts-ignore
    super(...arguments)
    this.options_ = options
    this.logger_ = logger
  }

  private async state(phone: string, service: AuthIdentityProviderService): Promise<OtpState | null> {
    try {
      const identity = await service.retrieve({ entity_id: phone })
      const pi = identity.provider_identities?.find((p) => p.provider === this.identifier)
      return (pi?.provider_metadata as OtpState) ?? {}
    } catch {
      return null
    }
  }

  async update(
    data: { entity_id?: string; code_hash?: string; now?: number },
    service: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const phone = normalizeIndianMobile(data?.entity_id)
    if (!phone || !data.code_hash) {
      return { success: false, error: "Invalid phone number" }
    }
    const now = data.now ?? Date.now()
    const current = await this.state(phone, service)

    const decision = canSendOtp(current ?? {}, now)
    if (!decision.ok) {
      return { success: false, error: `${decision.reason}:${Math.ceil(decision.retryAfterMs / 1000)}` }
    }

    const next = issuedState(current ?? {}, data.code_hash, now)
    if (current === null) {
      await service.create({ entity_id: phone, provider_metadata: next })
    } else {
      await service.update(phone, { provider_metadata: next })
    }
    return { success: true }
  }

  async authenticate(input: AuthenticationInput, service: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    const body = (input.body ?? {}) as { phone?: string; code?: string }
    const phone = normalizeIndianMobile(body.phone)
    if (!phone || typeof body.code !== "string") {
      return { success: false, error: GENERIC_ERROR }
    }
    const current = await this.state(phone, service)
    if (!current) {
      return { success: false, error: GENERIC_ERROR }
    }

    const result = verifyOtp(current, phone, body.code.trim(), this.options_.secret, Date.now())
    const identity = await service.update(phone, { provider_metadata: result.state })
    if (!result.ok) {
      return { success: false, error: result.reason === "locked" ? "Too many wrong codes. Ask for a new one." : GENERIC_ERROR }
    }
    return { success: true, authIdentity: identity }
  }

  async register(): Promise<AuthenticationResponse> {
    // Accounts are created on the first code request; there is nothing to register.
    return { success: false, error: "Use POST /store/otp/request to get a login code" }
  }
}

export default PhoneOtpAuthService
