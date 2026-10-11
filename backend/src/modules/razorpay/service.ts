import { createHmac, timingSafeEqual } from "crypto"
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
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { AbstractPaymentProvider, BigNumber, MedusaError, PaymentActions, PaymentSessionStatus } from "@medusajs/framework/utils"
import { RazorpayClient, RazorpayPayment } from "./client"

export type RazorpayOptions = {
  keyId?: string
  keySecret?: string
  webhookSecret?: string
  /** Tests only: a fake Razorpay API */
  apiBaseUrl?: string
}

/** What we keep in the payment session. Every field is set by this provider, never by the shopper. */
export type RazorpaySessionData = {
  razorpay_order_id: string
  /** In paise */
  amount: number
  currency: "INR"
  /** Public key for Razorpay Checkout in the browser */
  key_id: string
  session_id: string
  razorpay_payment_id?: string
}

export const toPaise = (amount: unknown) => Math.round(new BigNumber(amount as any).numeric * 100)

/**
 * Online payments (UPI, cards, net banking, wallets) with Razorpay.
 *
 * 1. initiatePayment creates a Razorpay order (manual capture) for the cart total.
 * 2. The browser opens Razorpay Checkout for that order.
 * 3. When the cart is completed (by the shop, or by the payment.authorized
 *    webhook if the shopper closed the page), authorizePayment asks Razorpay
 *    for the order's payments and captures the authorized one. Nothing the
 *    browser sends is trusted.
 */
class RazorpayProviderService extends AbstractPaymentProvider<RazorpayOptions> {
  static identifier = "razorpay"

  protected logger_: Logger
  protected options_: RazorpayOptions
  protected client_: RazorpayClient | null

  constructor(container: { logger: Logger }, options: RazorpayOptions) {
    // @ts-ignore same pattern as Medusa's own providers
    super(...arguments)
    this.logger_ = container.logger
    this.options_ = options
    this.client_ =
      options.keyId && options.keySecret ? new RazorpayClient(options.keyId, options.keySecret, options.apiBaseUrl || undefined) : null
  }

  protected client(): RazorpayClient {
    if (!this.client_) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Online payment is not set up (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)")
    }
    return this.client_
  }

  private async newOrder(amount: unknown, currency: string, sessionId: unknown): Promise<RazorpaySessionData> {
    if (currency.toLowerCase() !== "inr") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Razorpay payments are in INR only")
    }
    if (typeof sessionId !== "string" || !sessionId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing payment session")
    }
    const paise = toPaise(amount)
    if (paise < 100) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Amount too small for online payment")
    }
    const order = await this.client().createOrder({ amount: paise, receipt: sessionId, notes: { session_id: sessionId } })
    return { razorpay_order_id: order.id, amount: paise, currency: "INR", key_id: this.options_.keyId!, session_id: sessionId }
  }

  async initiatePayment({ amount, currency_code, data }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    // `data` comes from the shopper's request; only Medusa's session_id is used.
    const session = await this.newOrder(amount, currency_code, data?.session_id)
    return { id: session.razorpay_order_id, data: session, status: PaymentSessionStatus.PENDING }
  }

  async updatePayment({ amount, currency_code, data }: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const current = data as Partial<RazorpaySessionData> | undefined
    if (current?.razorpay_order_id && current.amount === toPaise(amount)) {
      return { data: current, status: PaymentSessionStatus.PENDING }
    }
    // Razorpay orders cannot change amount: make a new one
    return { data: await this.newOrder(amount, currency_code, current?.session_id), status: PaymentSessionStatus.PENDING }
  }

  /** The order's payment that is usable: captured, or authorized and ready to capture. */
  private async findPayment(session: RazorpaySessionData): Promise<RazorpayPayment | null> {
    const payments = await this.client().orderPayments(session.razorpay_order_id)
    const usable = payments.filter(
      (p) =>
        p.order_id === session.razorpay_order_id &&
        p.amount === session.amount &&
        p.currency === "INR" &&
        (p.status === "captured" || p.status === "authorized")
    )
    return usable.find((p) => p.status === "captured") ?? usable[0] ?? null
  }

  async authorizePayment({ data }: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const session = data as unknown as RazorpaySessionData
    if (!session?.razorpay_order_id || typeof session.amount !== "number") {
      return { status: PaymentSessionStatus.ERROR, data }
    }
    const payment = await this.findPayment(session)
    if (!payment) {
      // Not paid (yet): the cart is not completed
      return { status: PaymentSessionStatus.PENDING, data }
    }
    if (payment.status === "authorized") {
      await this.client().capture(payment.id, session.amount)
    }
    return { status: PaymentSessionStatus.CAPTURED, data: { ...session, razorpay_payment_id: payment.id } }
  }

  async capturePayment({ data }: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const session = data as unknown as RazorpaySessionData
    if (session?.razorpay_payment_id) {
      const payment = await this.client().fetchPayment(session.razorpay_payment_id)
      if (payment.status === "authorized") {
        await this.client().capture(payment.id, session.amount)
      }
    }
    return { data }
  }

  async refundPayment({ data, amount }: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const session = data as unknown as RazorpaySessionData
    if (!session?.razorpay_payment_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "No Razorpay payment to refund")
    }
    await this.client().refund(session.razorpay_payment_id, toPaise(amount))
    return { data }
  }

  async cancelPayment({ data }: CancelPaymentInput): Promise<CancelPaymentOutput> {
    // Called when placing the order fails after payment. A captured payment is
    // refunded in full; an uncaptured one is refunded by Razorpay automatically.
    const session = data as unknown as RazorpaySessionData
    if (session?.razorpay_payment_id) {
      const payment = await this.client().fetchPayment(session.razorpay_payment_id)
      if (payment.status === "captured") {
        await this.client().refund(payment.id, payment.amount)
      }
    }
    return { data }
  }

  async deletePayment({ data }: DeletePaymentInput): Promise<DeletePaymentOutput> {
    // Unpaid Razorpay orders simply expire
    return { data }
  }

  async getPaymentStatus({ data }: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const session = data as unknown as RazorpaySessionData
    if (!session?.razorpay_order_id) {
      return { status: PaymentSessionStatus.PENDING }
    }
    const payment = await this.findPayment(session)
    if (!payment) return { status: PaymentSessionStatus.PENDING }
    return { status: payment.status === "captured" ? PaymentSessionStatus.CAPTURED : PaymentSessionStatus.AUTHORIZED }
  }

  async retrievePayment({ data }: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const session = data as unknown as RazorpaySessionData
    if (session?.razorpay_payment_id) {
      const payment = await this.client().fetchPayment(session.razorpay_payment_id)
      return { data: { ...session, razorpay_status: payment.status } }
    }
    return { data }
  }

  /** True when the webhook body was signed with our webhook secret. */
  verifyWebhook(rawBody: string | Buffer | undefined, signature: unknown): boolean {
    const secret = this.options_.webhookSecret
    if (!secret || !rawBody || typeof signature !== "string" || !/^[0-9a-f]{64}$/.test(signature)) {
      return false
    }
    const expected = createHmac("sha256", secret).update(rawBody).digest()
    return timingSafeEqual(expected, Buffer.from(signature, "hex"))
  }

  /**
   * Razorpay webhook (POST /hooks/payment/razorpay_razorpay). Only
   * `payment.authorized` matters: it completes the order when the shopper paid
   * but closed the page before the shop could. The session id is read from
   * the Razorpay order we created, not from the webhook body.
   */
  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    const signature = payload.headers?.["x-razorpay-signature"]
    if (!this.verifyWebhook(payload.rawData as any, signature)) {
      this.logger_.warn("Razorpay webhook ignored: bad or missing signature")
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    const body = payload.data as any
    const payment = body?.payload?.payment?.entity as RazorpayPayment | undefined
    if (body?.event !== "payment.authorized" || !payment?.order_id) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    const order = await this.client().fetchOrder(payment.order_id)
    const sessionId = !Array.isArray(order.notes) ? order.notes?.session_id : undefined
    if (!sessionId) {
      // Not an order made by this shop
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    return { action: PaymentActions.AUTHORIZED, data: { session_id: sessionId, amount: order.amount / 100 } }
  }
}

export default RazorpayProviderService
