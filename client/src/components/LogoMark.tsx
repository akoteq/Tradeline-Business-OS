import Image from "next/image";
import clsx from "clsx";

/**
 * The Trunqo mark. Both versions are rendered and CSS shows one: the dark theme is set by the
 * data-theme attribute on <html> before paint, so a CSS swap avoids a flash of the wrong logo.
 * Fills its parent, which must be positioned and sized.
 */
export function LogoMark({ alt = "Trunqo", sizes, priority, className }: { alt?: string; sizes: string; priority?: boolean; className?: string }) {
  return (
    <>
      <Image src="/icon.png" alt={alt} fill sizes={sizes} priority={priority} className={clsx("logo-light", className)} />
      <Image src="/icon-dark.png" alt={alt} fill sizes={sizes} priority={priority} className={clsx("logo-dark", className)} />
    </>
  );
}
