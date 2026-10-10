/**
 * Indian mobile numbers: 10 digits starting 6-9, optionally written with
 * +91 / 91 / 0 in front and spaces or dashes. Returns "+91XXXXXXXXXX" or null.
 */
export function normalizeIndianMobile(input: unknown): string | null {
  if (typeof input !== "string") {
    return null
  }
  let digits = input.replace(/[\s\-().]/g, "")
  if (digits.startsWith("+91")) {
    digits = digits.slice(3)
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2)
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1)
  }
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null
}

/** "+91 98765 •••10" for logs and messages: never log full numbers. */
export function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 6)}•••${phone.slice(-2)}` : "•••"
}
