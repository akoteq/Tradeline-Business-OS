import type { Metadata } from "next";
import { SessionHandoff } from "@/components/marketing/SessionHandoff";
import { Access } from "@/components/marketing/sections/Access";
import { Attention } from "@/components/marketing/sections/Attention";
import { ClosingCta } from "@/components/marketing/sections/ClosingCta";
import { Hero } from "@/components/marketing/sections/Hero";
import { Modules } from "@/components/marketing/sections/Modules";
import { Performance } from "@/components/marketing/sections/Performance";
import { Platform } from "@/components/marketing/sections/Platform";
import { site } from "@/lib/site";

const title = `${site.name}: ${site.tagline}`;

export const metadata: Metadata = {
  title: { absolute: title },
  description: site.description,
  // /home and "/" show the same page. Tell search engines which one counts.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: site.name,
    title,
    description: site.description,
    locale: "en_GB",
    // The image comes from ./opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: site.description,
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    logo: `${site.url}/logo.png`,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: site.name,
    url: site.url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: site.description,
  },
];

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // "<" is escaped so the JSON can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <SessionHandoff />
      <Hero />
      <Attention />
      <Platform />
      <Performance />
      <Modules />
      <Access />
      <ClosingCta />
    </>
  );
}
