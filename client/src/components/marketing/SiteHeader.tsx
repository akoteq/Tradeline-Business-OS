import Link from "next/link";
import { site } from "@/lib/site";
import { Brand } from "./Brand";
import { Container } from "./ui";

const links = [
  { href: "#platform", label: "Platform" },
  { href: "#performance", label: "Performance" },
  { href: "#access", label: "Access" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        <Brand />
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-base text-muted transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
        <Link
          href={site.loginHref}
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-base font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Log in
        </Link>
      </Container>
    </header>
  );
}
