import { headers } from "next/headers"

/**
 * The visitor's address, to pass on to the backend when this server calls it
 * for them. Without it the backend sees every customer as this server and its
 * per-address limits (login codes, pincode checks) would be shared by everyone.
 * In production Caddy sets X-Forwarded-For and ignores any value the visitor
 * sends; the last entry is the one the nearest proxy added.
 */
export async function forwardedFor(): Promise<Record<string, string>> {
  const h = await headers()
  const ip = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean).pop() || h.get("x-real-ip")
  return ip ? { "x-forwarded-for": ip } : {}
}
