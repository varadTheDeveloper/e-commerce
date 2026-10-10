import { createHmac, randomInt, timingSafeEqual } from "crypto"

// One-time login codes. Codes are never stored: only an HMAC of
// (phone, code) with a server secret, so a database leak reveals nothing.
// With an SMS service that makes its own codes (Message Central), we keep
// its verification id instead and ask it to check the code; the expiry,
// wrong-try and resend limits below apply either way.

export const OTP_LENGTH = 6
export const OTP_TTL_MS = 5 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_AFTER_MS = 30 * 1000
export const OTP_MAX_SENDS_PER_HOUR = 5

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0")
}

export function hashOtp(phone: string, code: string, secret: string): string {
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex")
}

export function otpMatches(phone: string, code: string, secret: string, expectedHash: string): boolean {
  if (!/^\d{6}$/.test(code) || typeof expectedHash !== "string" || expectedHash.length !== 64) {
    return false
  }
  const actual = Buffer.from(hashOtp(phone, code, secret), "hex")
  const expected = Buffer.from(expectedHash, "hex")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** What we keep about the current code, inside the auth identity. */
export type OtpState = {
  code_hash?: string | null
  /** Verification id at the SMS service, when it made the code */
  provider_ref?: string | null
  expires_at?: number | null
  attempts?: number
  last_sent_at?: number | null
  /** Send times within the last hour, to cap SMS per number */
  sends?: number[]
  verified_at?: number | null
}

export type SendDecision = { ok: true } | { ok: false; reason: "too_soon" | "too_many"; retryAfterMs: number }

/** May we send a new code to this number now? */
export function canSendOtp(state: OtpState, now: number): SendDecision {
  if (state.last_sent_at && now - state.last_sent_at < OTP_RESEND_AFTER_MS) {
    return { ok: false, reason: "too_soon", retryAfterMs: OTP_RESEND_AFTER_MS - (now - state.last_sent_at) }
  }
  const recent = (state.sends ?? []).filter((t) => now - t < 60 * 60 * 1000)
  if (recent.length >= OTP_MAX_SENDS_PER_HOUR) {
    return { ok: false, reason: "too_many", retryAfterMs: 60 * 60 * 1000 - (now - Math.min(...recent)) }
  }
  return { ok: true }
}

/**
 * State after a new code was issued. `codeHash` is null when the SMS service
 * makes the code; its id is added with `withProviderRef` once it has sent it.
 */
export function issuedState(state: OtpState, codeHash: string | null, now: number): OtpState {
  const recent = (state.sends ?? []).filter((t) => now - t < 60 * 60 * 1000)
  return {
    ...state,
    code_hash: codeHash,
    provider_ref: null,
    expires_at: now + OTP_TTL_MS,
    attempts: 0,
    last_sent_at: now,
    sends: [...recent, now],
  }
}

export type VerifyResult =
  | { ok: true; state: OtpState }
  | { ok: false; reason: "no_code" | "expired" | "locked" | "wrong"; state: OtpState }

/** Adds the SMS service's verification id to the code issued just now. */
export function withProviderRef(state: OtpState, ref: string): OtpState {
  return { ...state, code_hash: null, provider_ref: ref }
}

const cleared = (state: OtpState): OtpState => ({ ...state, code_hash: null, provider_ref: null })

/**
 * Checks done before looking at the code: is there a live code, and tries left?
 * Returns null when the code may be checked.
 */
export function precheckOtp(state: OtpState, now: number): Extract<VerifyResult, { ok: false }> | null {
  if ((!state.code_hash && !state.provider_ref) || !state.expires_at) {
    return { ok: false, reason: "no_code", state }
  }
  if (now > state.expires_at) {
    return { ok: false, reason: "expired", state: cleared(state) }
  }
  if ((state.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: "locked", state: cleared(state) }
  }
  return null
}

/** State after a code was checked (attempts counted, code cleared on success or lock-out). */
export function afterCheck(state: OtpState, outcome: "ok" | "wrong" | "expired", now: number): VerifyResult {
  if (outcome === "ok") {
    return { ok: true, state: { ...cleared(state), expires_at: null, attempts: 0, verified_at: now } }
  }
  if (outcome === "expired") {
    return { ok: false, reason: "expired", state: cleared(state) }
  }
  const attempts = (state.attempts ?? 0) + 1
  return {
    ok: false,
    reason: "wrong",
    state: attempts >= OTP_MAX_ATTEMPTS ? { ...cleared(state), attempts } : { ...state, attempts },
  }
}

/** Checks a code made by this server; returns the state to save. */
export function verifyOtp(state: OtpState, phone: string, code: string, secret: string, now: number): VerifyResult {
  const refused = precheckOtp(state, now)
  if (refused) {
    return refused
  }
  if (!state.code_hash) {
    return { ok: false, reason: "no_code", state }
  }
  return afterCheck(state, otpMatches(phone, code, secret, state.code_hash) ? "ok" : "wrong", now)
}
