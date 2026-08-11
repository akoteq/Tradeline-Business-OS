import type { Metadata } from "next";
import { Manrope, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

const siteUrl = "https://trunqo.com";
const siteName = "Trunqo";
const siteDescription =
  "Trunqo is the business operating system for owners running more than one company. One alert feed, one accounting engine, and a delegation model that scopes access down to what each person owns — delivered straight to WhatsApp and email the moment it matters.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — The trunk your businesses grow from`,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    "business operating system",
    "multi-business management",
    "delegation software",
    "accounting automation",
    "business alerts WhatsApp",
    "SME management platform",
    "holding company software",
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  category: "Business software",
  applicationName: siteName,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title: `${siteName} — The trunk your businesses grow from`,
    description: siteDescription,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${siteName} — the trunk your businesses grow from`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} — The trunk your businesses grow from`,
    description: siteDescription,
    images: ["/og-image.png"],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#f3eee4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${instrumentSerif.variable} h-full`}
    >
      <body className="min-h-full antialiased bg-background text-foreground font-sans">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}