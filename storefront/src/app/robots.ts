import { getBaseURL } from "@lib/util/env"
import { MetadataRoute } from "next"

// Personal pages stay out of search engines.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/*/account", "/*/cart", "/*/checkout", "/*/order", "/*/search"],
    },
    host: getBaseURL(),
  }
}
