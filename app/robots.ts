import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/crm",
          "/finance",
          "/hrm",
          "/inventory",
          "/purchase",
          "/pos",
          "/pos-admin",
          "/tickets",
          "/users",
          "/website",
          "/branches",
          "/dispatches",
          "/docs",
          "/login",
          "/uploads/",
          "/order-demo",
          "/exact-order",
          "/minimal-order",
          "/order-integration",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
