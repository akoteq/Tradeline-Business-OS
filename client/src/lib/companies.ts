import { useQuery } from "@tanstack/react-query";
import { fetcher } from "./api";

export type DealSource = "BAPX" | "TRADELINE" | "COMPANY";

export type Company = {
  id: string;
  key: string;
  name: string;
  slug: string;
  dealSource: DealSource;
  color: string;
  order: number;
  isActive: boolean;
};

// Static fallback mirroring the server's DEFAULT_COMPANIES, so labels/menus render
// instantly on first paint and still work if the request is in flight.
export const DEFAULT_COMPANIES: Company[] = [
  { id: "BAPX",              key: "BAPX",              name: "BAPX",                     slug: "bapx",              dealSource: "BAPX",      color: "green",   order: 10, isActive: true },
  { id: "TRADELINE",         key: "TRADELINE",         name: "Tradeline Consult",        slug: "tradeline",         dealSource: "TRADELINE", color: "indigo",  order: 20, isActive: true },
  { id: "ALPHA_AFRICA",      key: "ALPHA_AFRICA",      name: "Alpha Africa Consult Ltd", slug: "alpha-africa",      dealSource: "COMPANY",   color: "indigo",  order: 30, isActive: true },
  { id: "FINANCE_FACTORY",   key: "FINANCE_FACTORY",   name: "Finance Factory Limited",  slug: "finance-factory",   dealSource: "COMPANY",   color: "emerald", order: 40, isActive: true },
  { id: "COMMUNITY_FINANCE", key: "COMMUNITY_FINANCE", name: "Community Finance Ltd",    slug: "community-finance", dealSource: "COMPANY",   color: "sky",     order: 50, isActive: true },
  { id: "AKOTEQ",            key: "AKOTEQ",            name: "Akoteq Ltd",               slug: "akoteq",            dealSource: "COMPANY",   color: "violet",  order: 60, isActive: true },
];

// The route a company's pipeline lives at. BAPX and Tradeline keep their bespoke pages;
// every other (admin-added) company uses the shared dynamic /pipeline/:slug route.
export function companyHref(c: Pick<Company, "dealSource" | "slug">): string {
  if (c.dealSource === "BAPX") return "/bapx/pipeline";
  if (c.dealSource === "TRADELINE") return "/tradeline/pipeline";
  return `/pipeline/${c.slug}`;
}

export function useCompanies() {
  const { data = DEFAULT_COMPANIES, isLoading } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: () => fetcher("/companies"),
  });
  const byKey: Record<string, Company> = Object.fromEntries(data.map((c) => [c.key, c]));
  const bySlug: Record<string, Company> = Object.fromEntries(data.map((c) => [c.slug, c]));
  return { companies: data, byKey, bySlug, isLoading };
}
