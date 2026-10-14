const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Security headers on every page. No full Content-Security-Policy yet: Next.js
 * pages need inline scripts, and Razorpay's checkout loads its own scripts and frames.
 */
const securityHeaders = [
  // No other site may show our pages in a frame (stops clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Payment is used by Razorpay's window on our pages
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://api.razorpay.com\")" },
  // Browsers only ever use HTTPS for the shop (ignored on plain-HTTP localhost)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
]

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Docker image (deploy/storefront.Dockerfile): one self-contained server folder, .next/standalone.
  // Elsewhere the usual build, so `next start` keeps working for development and CI.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  images: {
    remotePatterns: [
      // Local development and tests: photos served by the backend on localhost
      ...(process.env.ALLOW_LOCALHOST_IMAGES === "false" ? [] : [{ protocol: "http", hostname: "localhost" }]),
      // Demo photos (Unsplash, free licence); remove once the brand's photos are in
      { protocol: "https", hostname: "images.unsplash.com" },
      // Server: hosts of uploaded photos (S3 bucket or the API), comma-separated, set at build time
      ...(process.env.IMAGE_HOSTS ?? "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((hostname) => ({ protocol: "https", hostname })),
    ],
  },
}

module.exports = nextConfig
