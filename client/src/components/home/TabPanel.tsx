"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

const tabFade = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

/** One crossfading tab body. Render inside <AnimatePresence mode="wait"> with a unique key. */
export function TabPanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.section
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={tabFade}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}
