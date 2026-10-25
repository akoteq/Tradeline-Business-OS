/**
 * One source of truth for the public brand. The landing page, metadata, sitemap,
 * robots and the share image all read from here, so the name is never spelled two ways.
 */
export const site = {
  name: "Trunqo",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://trunqo.com",
  category: "Business operating system",
  tagline: "The trunk your businesses grow from",
  description:
    "Trunqo is the business operating system for owners running more than one company. Leads, clients, targets, finances, risks and people across every business, in one place.",
  loginHref: "/login",
  /**
   * Add { label: "Privacy", href: "/privacy" } and { label: "Terms", href: "/terms" } here once
   * those pages exist. The footer only renders links listed here, so it never points at a 404.
   */
  legalLinks: [] as { label: string; href: string }[],
};
