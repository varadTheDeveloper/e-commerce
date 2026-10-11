// Small client for the parts of the Razorpay REST API the shop uses.
// https://razorpay.com/docs/api/ . Amounts are in paise.

export type RazorpayOrder = {
  id: string
  amount: number
  currency: string
  status: string
  notes?: Record<string, string> | []
}

export type RazorpayPayment = {
  id: string
  order_id: string
  amount: number
  currency: string
  /** created | authorized | captured | refunded | failed */
  status: string
  method?: string
}

export class RazorpayError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

const TIMEOUT_MS = 15_000

export class RazorpayClient {
  private readonly auth: string

  constructor(
    keyId: string,
    keySecret: string,
    private readonly baseUrl = "https://api.razorpay.com",
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64")
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/+$/, "")}/v1${path}`, {
      method,
      headers: { authorization: this.auth, "content-type": "application/json", accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    let json: any = null
    try {
      json = await res.json()
    } catch {
      // empty or not JSON
    }
    if (!res.ok) {
      // Razorpay's error description names the problem without customer data
      const reason = typeof json?.error?.description === "string" ? json.error.description.slice(0, 200) : ""
      throw new RazorpayError(`Razorpay ${method} ${path.split("/")[1]} failed (HTTP ${res.status}) ${reason}`.trim(), res.status)
    }
    return json as T
  }

  /**
   * Creates an order whose payments are captured by us (manual capture), so money
   * is only taken once the shop has placed the order and reserved the stock.
   * Payments left uncaptured are refunded by Razorpay automatically.
   */
  createOrder(input: { amount: number; receipt: string; notes: Record<string, string> }) {
    return this.request<RazorpayOrder>("POST", "/orders", {
      amount: input.amount,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
      payment: {
        capture: "manual",
        capture_options: { manual_expiry_period: 7200, refund_speed: "optimum" },
      },
    })
  }

  fetchOrder(id: string) {
    return this.request<RazorpayOrder>("GET", `/orders/${encodeURIComponent(id)}`)
  }

  async orderPayments(orderId: string): Promise<RazorpayPayment[]> {
    const res = await this.request<{ items?: RazorpayPayment[] }>("GET", `/orders/${encodeURIComponent(orderId)}/payments`)
    return res.items ?? []
  }

  fetchPayment(id: string) {
    return this.request<RazorpayPayment>("GET", `/payments/${encodeURIComponent(id)}`)
  }

  capture(paymentId: string, amount: number) {
    return this.request<RazorpayPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, {
      amount,
      currency: "INR",
    })
  }

  refund(paymentId: string, amount: number) {
    return this.request<{ id: string; status: string }>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, {
      amount,
      speed: "optimum",
    })
  }
}
