import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: ["/", "/s/", "/account/login", "/account/register"], disallow: ["/app/", "/admin/", "/api/"] }, sitemap: "https://beauty.alphasystemsrl.it/sitemap.xml" };
}
