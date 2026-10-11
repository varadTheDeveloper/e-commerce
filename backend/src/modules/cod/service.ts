import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { AbstractPaymentProvider, MedusaError, PaymentActions, PaymentSessionStatus } from "@medusajs/framework/utils"
import { codTokenValid } from "../../lib/cod"
import { toPaise } from "../razorpay/service"

type Options = {
  /** Server secret that signs confirmed sessions (OTP_SECRET) */
  secret: string
  /** Highest order total allowed, in rupees */
  maxOrder: number
}

export type CodSessionData = {
  session_id: string
  /** In paise */
  amount: number
  /** Set by POST /store/cod/confirm after the SMS code was right */
  cod_token?: string
  phone?: string
}

/**
 * Cash on delivery. The session is authorized only when it carries a valid
 * signature from POST /store/cod/confirm and the amount is within the limit.
 * The money is collected by the courier; mark the payment captured in the
 * admin once it is received.
 */
class CodProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "cod"

  protected options_: Options

  static validateOptions(options: Record<string, unknown>) {
    if (typeof options.secret !== "string" || options.secret.length < 16) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cod: option 'secret' is required")
    }
    if (typeof options.maxOrder !== "number" || options.maxOrder <= 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cod: option 'maxOrder' is required")
    }
  }

  constructor(container: Record<string, unknown>, options: Options) {
    // @ts-ignore same pattern as Medusa's own providers
    super(...arguments)
    this.options_ = options
  }

  async initiatePayment({ amount, data }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    // Only Medusa's session_id is taken from `data` (the rest comes from the shopper)
    const sessionId = String(data?.session_id ?? "")
    const session: CodSessionData = { session_id: sessionId, amount: toPaise(amount) }
    return { id: sessionId, data: { ...session, cod_token: null, phone: null }, status: PaymentSessionStatus.PENDING }
  }

  async updatePayment({ amount, data }: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: { ...data, amount: toPaise(amount) }, status: PaymentSessionStatus.PENDING }
  }

  async authorizePayment({ data }: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const session = data as unknown as CodSessionData
    const withinLimit = typeof session?.amount === "number" && session.amount <= this.options_.maxOrder * 100
    if (!withinLimit || !codTokenValid(this.options_.secret, session.session_id, session.amount, session.cod_token)) {
      return { status: PaymentSessionStatus.ERROR, data }
    }
    return { status: PaymentSessionStatus.AUTHORIZED, data }
  }

  async capturePayment({ data }: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data }
  }

  async refundPayment({ data }: RefundPaymentInput): Promise<RefundPaymentOutput> {
    // Paid in cash: the refund is sent by bank transfer and recorded in the admin
    return { data }
  }

  async cancelPayment({ data }: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data }
  }

  async deletePayment({ data }: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data }
  }

  async getPaymentStatus({ data }: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    return { status: (data as any)?.cod_token ? PaymentSessionStatus.AUTHORIZED : PaymentSessionStatus.PENDING }
  }

  async retrievePayment({ data }: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data }
  }

  async getWebhookActionAndData(): Promise<WebhookActionResult> {
    return { action: PaymentActions.NOT_SUPPORTED }
  }
}

export default CodProviderService
