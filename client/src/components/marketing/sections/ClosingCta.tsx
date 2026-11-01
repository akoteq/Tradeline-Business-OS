import Link from "next/link";
import { site } from "@/lib/site";
import { Container } from "../ui";

export function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="border-t border-border">
      <Container className="py-20 lg:py-28">
        <div className="rounded-2xl bg-primary px-6 py-14 text-background sm:px-12 lg:py-20">
          <h2 id="cta-title" className="max-w-2xl text-3xl font-semibold sm:text-4xl">
            Already invited? Log in.
          </h2>
          <p className="mt-4 max-w-xl text-base text-background/70">
            Trunqo access is currently by invitation from your organisation.
          </p>
          <Link
            href={site.loginHref}
            className="mt-8 inline-flex h-11 items-center rounded-lg bg-background px-5 text-base font-medium text-foreground transition-opacity hover:opacity-90"
          >
            Log in
          </Link>
        </div>
      </Container>
    </section>
  );
}
