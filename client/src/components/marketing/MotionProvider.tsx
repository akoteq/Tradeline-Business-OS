"use client";

import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";

/**
 * Loads only the animation features the landing page uses (smaller bundle) and honours the
 * visitor's "reduce motion" setting: with it on, movement is skipped and only fades remain.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>{children}</LazyMotion>
    </MotionConfig>
  );
}
