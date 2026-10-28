import { LogoMark } from "@/components/LogoMark";
import Link from "next/link";
import { site } from "@/lib/site";

/**
 * Logo mark plus wordmark. The link goes to "/" with prefetch off on purpose: "/" is the landing
 * page for visitors and the dashboard for signed-in people, and a prefetched copy of the wrong one
 * could be reused after login.
 */
export function Brand() {
  return (
    <Link href="/" prefetch={false} aria-label={`${site.name} home`} className="inline-flex items-center gap-2.5">
      <span className="relative size-7 shrink-0">
        <LogoMark alt="" sizes="28px" priority className="rounded-lg object-contain" />
      </span>
      <span className="font-display text-lg font-semibold">{site.name}</span>
    </Link>
  );
}
