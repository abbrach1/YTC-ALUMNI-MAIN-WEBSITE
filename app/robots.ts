import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/admin-setup", "/request-access", "/access-denied"],
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/admin-setup", "/request-access", "/access-denied"],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/admin-setup", "/request-access", "/access-denied", "/login"],
      },
    ],
    sitemap: "https://ytcalumni.com/sitemap.xml",
    host: "https://ytcalumni.com",
  }
}
