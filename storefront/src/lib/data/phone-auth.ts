"use server"

import { sdk } from "@lib/config"
import { forwardedFor } from "@lib/util/client-ip"
import { updateTag } from "next/cache"
import { getAuthHeaders, getCacheTag, setAuthToken } from "./cookies"
import { transferCart } from "./customer"

// Phone login: request a code, verify it, and (first time only) create the account.
// Errors come back as codes; the login screen shows them in the visitor's language.

export type AuthError =
  | "invalid_phone"
  | "consent_required"
  | "too_soon"
  | "too_many"
  | "sms_failed"
  | "wrong_code"
  | "locked"
  | "invalid_name"
  | "generic"

type Fail = { ok: false; error: AuthError; retryAfter?: number }

function errorFrom(e: unknown): Fail {
  const err = e as { status?: number; message?: string; type?: string; retry_after?: number }
  const msg = String(err?.message ?? "")
  if (err?.status === 429 || /wait|too many/i.test(msg)) {
    const tooMany = /too many/i.test(msg)
    return { ok: false, error: tooMany ? "too_many" : "too_soon" }
  }
  if (/mobile number|phone/i.test(msg)) return { ok: false, error: "invalid_phone" }
  if (/SMS/i.test(msg)) return { ok: false, error: "sms_failed" }
  if (/Too many wrong codes/i.test(msg)) return { ok: false, error: "locked" }
  if (/Invalid or expired code/i.test(msg)) return { ok: false, error: "wrong_code" }
  return { ok: false, error: "generic" }
}

function decodeToken(token: string): { actor_id?: string } {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))
  } catch {
    return {}
  }
}

async function afterLogin() {
  updateTag(await getCacheTag("customers"))
  try {
    await transferCart()
  } catch {
    // The bag stays as a guest bag; nothing else to do
  }
}

/** Sends a 6-digit code by SMS. */
export async function requestLoginCode(phone: string): Promise<{ ok: true; resendAfter: number } | Fail> {
  try {
    const res = await sdk.client.fetch<{ sent: boolean; resend_after: number }>("/store/otp/request", {
      method: "POST",
      headers: await forwardedFor(),
      body: { phone },
    })
    return { ok: true, resendAfter: res.resend_after ?? 30 }
  } catch (e) {
    return errorFrom(e)
  }
}

/** Checks the code. `isNew` means the number has no account yet: ask for a name next. */
export async function verifyLoginCode(phone: string, code: string): Promise<{ ok: true; isNew: boolean } | Fail> {
  try {
    const res = await sdk.client.fetch<{ token: string }>("/auth/customer/phone-otp", {
      method: "POST",
      body: { phone, code },
    })
    await setAuthToken(res.token)
    const isNew = !decodeToken(res.token).actor_id
    if (!isNew) await afterLogin()
    return { ok: true, isNew }
  } catch (e) {
    return errorFrom(e)
  }
}

/** First login only: creates the customer for the verified number. */
export async function completeSignup(data: {
  firstName: string
  lastName?: string
  email?: string
  /** Ticked "18 or older, agree to the privacy policy and terms" */
  consent: boolean
}): Promise<{ ok: true } | Fail> {
  const firstName = data.firstName.trim()
  if (!firstName || firstName.length > 60) return { ok: false, error: "invalid_name" }
  if (!data.consent) return { ok: false, error: "consent_required" }
  try {
    const headers = await getAuthHeaders()
    await sdk.client.fetch("/store/otp/account", {
      method: "POST",
      headers,
      body: {
        first_name: firstName,
        privacy_consent: true,
        ...(data.lastName?.trim() ? { last_name: data.lastName.trim() } : {}),
        ...(data.email?.trim() ? { email: data.email.trim() } : {}),
      },
    })
    // The old token has no customer in it yet; get one that does
    const refreshed = await sdk.client.fetch<{ token: string }>("/auth/token/refresh", { method: "POST", headers })
    await setAuthToken(refreshed.token)
    await afterLogin()
    return { ok: true }
  } catch (e) {
    return errorFrom(e)
  }
}
