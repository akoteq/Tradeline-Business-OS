import Link from "next/link";
import { site } from "@/lib/site";
import { Rise } from "../Rise";
import { ScreenFrame } from "../ScreenFrame";
import { screens } from "../screens";
import { Container, buttonPrimary } from "../ui";

export function Hero() {
  return (
    <section aria-labelledby="hero-title">
      <Container className="pb-20 pt-16 sm:pt-24 lg:pb-28">
        <Rise>
          <h1 id="hero-title" className="max-w-4xl text-4xl font-semibold sm:text-5xl lg:text-6xl">
           Every company you run. Every owner. Every date. One view.
          </h1>
        </Rise>

        <Rise delay={0.08}>
          <p className="type-lede mt-6">
            Trunqo shows you which deals went quiet, which targets slipped and which approvals are waiting, so you act before it costs you.
          </p>
        </Rise>

        <Rise delay={0.16} className="mt-9">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
            <Link href={site.loginHref} className={buttonPrimary}>
              Log in
            </Link>
            <a href="#platform" className="text-base font-medium text-foreground underline-offset-4 hover:underline">
              See how it works
            </a>
          </div>
          <p className="mt-4 text-sm text-muted">Access is currently by invitation from your organisation.</p>
        </Rise>

        <Rise fade={false} delay={0.24} className="mt-14 lg:mt-20">
          <ScreenFrame
            screen={screens.companyKpis}
            priority
            elevated
            sizes="(min-width: 1152px) 1088px, 100vw"
          />
        </Rise>
      </Container>
    </section>
  );
}
