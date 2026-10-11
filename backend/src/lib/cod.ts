import { createHmac, timingSafeEqual } from "crypto"

// A cash-on-delivery order is placed only after the customer typed the SMS
// code sent to their phone. The confirm route then signs the payment session
// (id + amount) with the server secret; the COD payment provider accepts the
// session only with a valid signature, so it cannot be faked from the browser.

export function codToken(secret: string, sessionId: string, amountPaise: number): string {
  return createHmac("sha256", secret).update(`cod:${sessionId}:${amountPaise}`).digest("hex")
}

export function codTokenValid(secret: string, sessionId: unknown, amountPaise: unknown, token: unknown): boolean {
  if (typeof sessionId !== "string" || typeof amountPaise !== "number" || typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) {
    return false
  }
  return timingSafeEqual(Buffer.from(codToken(secret, sessionId, amountPaise), "hex"), Buffer.from(token, "hex"))
}
