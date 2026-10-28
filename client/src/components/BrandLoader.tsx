"use client";

import { LogoMark } from "@/components/LogoMark";
import { motion, useReducedMotion } from "framer-motion";

interface BrandLoaderProps {
  /** Screen-reader label. Doesn't render visibly. */
  label?: string;
  /** Set false to render inline (e.g. inside a card) instead of full-screen. */
  fullScreen?: boolean;
}

export function BrandLoader({ label = "Loading", fullScreen = true }: BrandLoaderProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={
        fullScreen
          ? "fixed inset-0 z-50 flex items-center justify-center bg-background"
          : "flex items-center justify-center py-16"
      }
    >
      <span className="sr-only">{label}</span>

      <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
        {!shouldReduceMotion && (
          <>
            <motion.span
              className="absolute rounded-2xl border border-accent/40"
              style={{ width: 64, height: 64 }}
              animate={{ scale: [1, 1.7, 1.7], opacity: [0.55, 0, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              className="absolute rounded-2xl border border-accent/30"
              style={{ width: 64, height: 64 }}
              animate={{ scale: [1, 1.7, 1.7], opacity: [0.55, 0, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1 }}
            />
          </>
        )}

        <motion.div
          className="relative rounded-2xl overflow-hidden"
          style={{ width: 64, height: 64 }}
          animate={
            shouldReduceMotion
              ? { opacity: [0.65, 1, 0.65] }
              : { scale: [1, 1.06, 1] }
          }
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <LogoMark sizes="64px" priority className="object-contain" />
        </motion.div>
      </div>
    </motion.div>
  );
}