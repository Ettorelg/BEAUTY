import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://beauty.alphasystemsrl.it";
  return ["", "/account/login", "/account/register", "/privacy", "/terms"].map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path ? "monthly" : "weekly", priority: path ? 0.6 : 1 }));
}
