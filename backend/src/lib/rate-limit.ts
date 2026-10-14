import { createHash } from "crypto"

// Small fixed-window rate limiter kept in memory. Fine for one server;
// move to Redis if the backend ever runs on several machines.

type Bucket = { count: number; resetAt: number }

export class RateLimiter {
  private buckets = new Map<string, Bucket>()

  constructor(private readonly max: number, private readonly windowMs: number, private readonly maxKeys = 50_000) {}

  /** Returns milliseconds to wait, or 0 if the hit is allowed. */
  hit(key: string, now = Date.now()): number {
    const id = createHash("sha256").update(key).digest("base64url").slice(0, 22) // never keep raw IPs
    const bucket = this.buckets.get(id)
    if (!bucket || bucket.resetAt <= now) {
      if (this.buckets.size >= this.maxKeys) this.sweep(now)
      this.buckets.set(id, { count: 1, resetAt: now + this.windowMs })
      return 0
    }
    if (bucket.count >= this.max) {
      return bucket.resetAt - now
    }
    bucket.count++
    return 0
  }

  /** Milliseconds to wait if the limit is reached, without counting a hit. */
  check(key: string, now = Date.now()): number {
    const bucket = this.buckets.get(createHash("sha256").update(key).digest("base64url").slice(0, 22))
    return bucket && bucket.resetAt > now && bucket.count >= this.max ? bucket.resetAt - now : 0
  }

  private sweep(now: number) {
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k)
    if (this.buckets.size >= this.maxKeys) this.buckets.clear()
  }
}
