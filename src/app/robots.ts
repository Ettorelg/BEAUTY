import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: ["/", "/s/", "/account/login", "/account/register"], disallow: ["/app/", "/admin/", "/api/"] }, sitemap: "https://prenota.alphasystemsrl.it/sitemap.xml" };
}
