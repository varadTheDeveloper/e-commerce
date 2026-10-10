// Login-code settings from the environment, shared by medusa-config.ts,
// the auth provider and the request route.

const DEV_SECRET = "dev-only-otp-secret-change-me-0000"

export function otpConfig(env = process.env) {
  const production = env.NODE_ENV === "production"
  const secret = env.OTP_SECRET || (production ? "" : DEV_SECRET)
  // A fixed code for automated tests; only with the console SMS provider, never in production.
  const testCode =
    !production && (env.SMS_PROVIDER ?? "console") === "console" && /^\d{6}$/.test(env.OTP_TEST_CODE ?? "") ? env.OTP_TEST_CODE : undefined
  return { secret, testCode, production }
}
