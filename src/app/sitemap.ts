import type { MetadataRoute } from "next";
import { GUIDES } from "@/content/guides";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://formbridge.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/calculator`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE}/guides`, changeFrequency: "weekly", priority: 0.8 },
    ...GUIDES.map((g) => ({
      url: `${SITE}/guides/${g.slug}`,
      lastModified: g.updated,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
