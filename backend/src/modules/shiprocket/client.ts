// Small client for the parts of the Shiprocket API the shop uses.
// https://apidocs.shiprocket.in . Logs in with an "API user" (Settings → API in
// the Shiprocket panel); the token lasts 10 days and is renewed before that.

export type ShiprocketCourier = {
  courier_company_id: number
  courier_name: string
  /** Expected delivery date, e.g. "Oct 15, 2026" */
  etd?: string
  estimated_delivery_days?: string | number
  /** 1 when the courier accepts cash on delivery here */
  cod: number
  rate?: number
}

export type AdhocOrderInput = {
  order_id: string
  order_date: string
  pickup_location: string
  billing_customer_name: string
  billing_last_name: string
  billing_address: string
  billing_address_2: string
  billing_city: string
  billing_pincode: string
  billing_state: string
  billing_country: string
  billing_email: string
  billing_phone: string
  shipping_is_billing: boolean
  order_items: { name: string; sku: string; units: number; selling_price: number; hsn?: string }[]
  payment_method: "COD" | "Prepaid"
  sub_total: number
  shipping_charges: number
  length: number
  breadth: number
  height: number
  weight: number
}

/** A return pickup: from the customer's address back to the warehouse. */
export type ReturnOrderInput = {
  order_id: string
  order_date: string
  pickup_customer_name: string
  pickup_last_name: string
  pickup_address: string
  pickup_address_2: string
  pickup_city: string
  pickup_state: string
  pickup_country: string
  pickup_pincode: string
  pickup_email: string
  pickup_phone: string
  shipping_customer_name: string
  shipping_last_name: string
  shipping_address: string
  shipping_address_2: string
  shipping_city: string
  shipping_state: string
  shipping_country: string
  shipping_pincode: string
  shipping_email: string
  shipping_phone: string
  order_items: { name: string; sku: string; units: number; selling_price: number; hsn?: string }[]
  payment_method: "PREPAID"
  sub_total: number
  length: number
  breadth: number
  height: number
  weight: number
}

export class ShiprocketError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

const TIMEOUT_MS = 20_000
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000

export class ShiprocketClient {
  private token: { value: string; until: number } | null = null

  constructor(
    private readonly email: string,
    private readonly password: string,
    private readonly baseUrl = "https://apiv2.shiprocket.in",
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  private url(path: string) {
    return `${this.baseUrl.replace(/\/+$/, "")}/v1/external${path}`
  }

  private async login(): Promise<string> {
    if (this.token && this.token.until > Date.now()) return this.token.value
    const res = await this.fetchImpl(this.url("/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const json: any = await res.json().catch(() => null)
    if (!res.ok || typeof json?.token !== "string") {
      throw new ShiprocketError(`Shiprocket login failed (HTTP ${res.status})`, res.status)
    }
    this.token = { value: json.token, until: Date.now() + TOKEN_TTL_MS }
    return json.token
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
    for (const retry of [false, true]) {
      const url = new URL(this.url(path))
      for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v)
      const res = await this.fetchImpl(url, {
        method,
        headers: { authorization: `Bearer ${await this.login()}`, "content-type": "application/json", accept: "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.status === 401 && !retry) {
        this.token = null
        continue
      }
      const json: any = await res.json().catch(() => null)
      if (!res.ok) {
        // Shiprocket's message names the problem; it does not echo customer data
        const reason = typeof json?.message === "string" ? json.message.slice(0, 200) : ""
        throw new ShiprocketError(`Shiprocket ${path} failed (HTTP ${res.status}) ${reason}`.trim(), res.status)
      }
      return json as T
    }
    throw new ShiprocketError("Shiprocket login expired", 401)
  }

  /** Couriers that deliver from the pickup pincode to `pincode`. */
  async serviceability(input: { pickupPincode: string; pincode: string; weightKg: number; cod: boolean }) {
    const res = await this.request<{ data?: { available_courier_companies?: ShiprocketCourier[]; recommended_courier_company_id?: number } }>(
      "GET",
      "/courier/serviceability/",
      undefined,
      {
        pickup_postcode: input.pickupPincode,
        delivery_postcode: input.pincode,
        weight: String(input.weightKg),
        cod: input.cod ? "1" : "0",
      }
    ).catch((e) => {
      // Shiprocket answers 404 when no courier serves the pincode
      if (e instanceof ShiprocketError && (e.status === 404 || e.status === 422)) return { data: undefined }
      throw e
    })
    return {
      couriers: res.data?.available_courier_companies ?? [],
      recommended: res.data?.recommended_courier_company_id,
    }
  }

  createOrder(input: AdhocOrderInput) {
    return this.request<{ order_id: number; shipment_id: number; status?: string }>("POST", "/orders/create/adhoc", input)
  }

  createReturnOrder(input: ReturnOrderInput) {
    return this.request<{ order_id: number; shipment_id: number; status?: string }>("POST", "/orders/create/return", input)
  }

  async assignAwb(shipmentId: number, courierId?: number, isReturn = false) {
    const res = await this.request<any>("POST", "/courier/assign/awb", {
      shipment_id: shipmentId,
      ...(courierId ? { courier_id: courierId } : {}),
      ...(isReturn ? { is_return: 1 } : {}),
    })
    const data = res?.response?.data ?? {}
    if (!data.awb_code) {
      throw new ShiprocketError(`Shiprocket could not assign a courier: ${String(res?.message ?? data.awb_assign_error ?? "no AWB").slice(0, 200)}`, 400)
    }
    return { awb: String(data.awb_code), courierName: String(data.courier_name ?? ""), courierId: Number(data.courier_company_id) }
  }

  generatePickup(shipmentId: number) {
    return this.request<any>("POST", "/courier/generate/pickup", { shipment_id: [shipmentId] })
  }

  async generateLabel(shipmentId: number): Promise<string | null> {
    const res = await this.request<{ label_url?: string }>("POST", "/courier/generate/label", { shipment_id: [shipmentId] })
    return res.label_url ?? null
  }

  cancelOrders(orderIds: number[]) {
    return this.request<any>("POST", "/orders/cancel", { ids: orderIds })
  }
}
