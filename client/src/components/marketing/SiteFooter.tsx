import { site } from "@/lib/site";
import { Brand } from "./Brand";
import { Container } from "./ui";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Brand />
          <p className="mt-3 text-sm text-muted">{site.tagline}.</p>
        </div>
        <div className="flex flex-col gap-3 text-sm text-muted sm:items-end">
          {site.legalLinks.length > 0 && (
            <nav aria-label="Legal" className="flex gap-6">
              {site.legalLinks.map((l) => (
                <a key={l.href} href={l.href} className="transition-colors hover:text-foreground">
                  {l.label}
                </a>
              ))}
            </nav>
          )}
          <p>&copy; {new Date().getFullYear()} {site.name}. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
}
