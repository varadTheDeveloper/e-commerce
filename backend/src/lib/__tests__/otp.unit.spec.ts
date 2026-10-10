import {
  canSendOtp,
  generateOtp,
  hashOtp,
  issuedState,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_AFTER_MS,
  OTP_TTL_MS,
  otpMatches,
  verifyOtp,
} from "../otp"

const SECRET = "test-secret-test-secret"
const PHONE = "+919876543210"
const T0 = 1_700_000_000_000

describe("login codes", () => {
  it("generates 6-digit codes", () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/)
  })

  it("hashes per phone and secret, and compares safely", () => {
    const h = hashOtp(PHONE, "123456", SECRET)
    expect(h).toHaveLength(64)
    expect(otpMatches(PHONE, "123456", SECRET, h)).toBe(true)
    expect(otpMatches(PHONE, "123457", SECRET, h)).toBe(false)
    expect(otpMatches("+919876543211", "123456", SECRET, h)).toBe(false)
    expect(otpMatches(PHONE, "123456", "other-secret-other", h)).toBe(false)
    expect(otpMatches(PHONE, "12345", SECRET, h)).toBe(false)
    expect(otpMatches(PHONE, "123456", SECRET, "short")).toBe(false)
  })

  it("verifies once, then the code is gone", () => {
    const state = issuedState({}, hashOtp(PHONE, "111222", SECRET), T0)
    const ok = verifyOtp(state, PHONE, "111222", SECRET, T0 + 1000)
    expect(ok.ok).toBe(true)
    expect(ok.state.code_hash).toBeNull()
    expect(verifyOtp(ok.state, PHONE, "111222", SECRET, T0 + 2000)).toMatchObject({ ok: false, reason: "no_code" })
  })

  it("expires after the time limit", () => {
    const state = issuedState({}, hashOtp(PHONE, "111222", SECRET), T0)
    expect(verifyOtp(state, PHONE, "111222", SECRET, T0 + OTP_TTL_MS + 1)).toMatchObject({ ok: false, reason: "expired" })
  })

  it("locks after too many wrong codes, even if the right one comes next", () => {
    let state = issuedState({}, hashOtp(PHONE, "111222", SECRET), T0)
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      const r = verifyOtp(state, PHONE, "000000", SECRET, T0 + 1000)
      expect(r.ok).toBe(false)
      state = r.state
    }
    expect(verifyOtp(state, PHONE, "111222", SECRET, T0 + 2000).ok).toBe(false)
  })

  it("makes people wait between codes and caps codes per hour", () => {
    let state = issuedState({}, "x".repeat(64), T0)
    expect(canSendOtp(state, T0 + 1000)).toMatchObject({ ok: false, reason: "too_soon" })
    let now = T0
    for (let i = 1; i < 5; i++) {
      now += OTP_RESEND_AFTER_MS
      expect(canSendOtp(state, now).ok).toBe(true)
      state = issuedState(state, "x".repeat(64), now)
    }
    expect(canSendOtp(state, now + OTP_RESEND_AFTER_MS)).toMatchObject({ ok: false, reason: "too_many" })
    expect(canSendOtp(state, T0 + 61 * 60 * 1000).ok).toBe(true)
  })

  it("a new code resets the wrong-attempt count", () => {
    let state = issuedState({}, hashOtp(PHONE, "111222", SECRET), T0)
    state = verifyOtp(state, PHONE, "000000", SECRET, T0 + 1000).state
    expect(state.attempts).toBe(1)
    state = issuedState(state, hashOtp(PHONE, "333444", SECRET), T0 + OTP_RESEND_AFTER_MS)
    expect(state.attempts).toBe(0)
    expect(verifyOtp(state, PHONE, "333444", SECRET, T0 + OTP_RESEND_AFTER_MS + 1).ok).toBe(true)
  })
})
