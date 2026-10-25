import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Only public pages. The app routes sit behind a login and are marked noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: site.url, changeFrequency: "monthly", priority: 1 }];
}
