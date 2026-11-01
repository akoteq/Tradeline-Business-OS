import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>{children}</div>;
}

/** Primary action. Ink on white keeps contrast well above 4.5:1; the orange is kept for accents. */
export const buttonPrimary =
  "inline-flex h-11 items-center rounded-lg bg-primary px-5 text-base font-medium text-background transition-opacity hover:opacity-90";

/**
 * Heading on the left, content on the right, a hairline above. The heading stays in view while
 * the content scrolls on large screens. Used for every list-style section so they read as one system.
 */
export function LedgerSection({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16 border-t border-border">
      <Container className="grid gap-10 py-20 lg:grid-cols-12 lg:gap-16 lg:py-28">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <h2 id={`${id}-title`} className="text-3xl font-semibold">
              {title}
            </h2>
            {lede && <p className="type-lede mt-4">{lede}</p>}
          </div>
        </div>
        <div className="lg:col-span-8">{children}</div>
      </Container>
    </section>
  );
}
