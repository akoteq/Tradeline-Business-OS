"use client";

import { m } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const; // matches --ease-smooth in globals.css

/**
 * The page's one orchestrated moment: the hero settles into place on load, top to bottom.
 * Nothing else on the page animates by itself.
 *
 * `fade={false}` moves the element without hiding it. Use that for the large product screen,
 * so the biggest thing above the fold paints immediately and is never held back by hydration.
 */
export function Rise({
  children,
  delay = 0,
  fade = true,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  fade?: boolean;
  className?: string;
}) {
  return (
    <m.div
      data-reveal
      className={className}
      initial={fade ? { opacity: 0, y: 16 } : { y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay, ease: EASE }}
    >
      {children}
    </m.div>
  );
}
