"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { clsx } from "clsx";

/**
 * Light / dark switch for the top bar. Light by default; choosing dark sets data-theme="dark" on
 * <html> and remembers it on this device. The colours live in globals.css, and the (app) layout
 * applies a saved choice before the first paint so the page doesn't flash light.
 */

export const THEME_KEY = "trunqo.theme";
type Theme = "light" | "dark";

export function ThemeToggle({ className }: { className?: string }) {
  // Read once after mount (localStorage isn't on the server).
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    let saved: Theme = "light";
    try { if (localStorage.getItem(THEME_KEY) === "dark") saved = "dark"; } catch { /* storage blocked: stay light */ }
    document.documentElement.dataset.theme = saved;
    setTheme(saved);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* it just won't stick */ }
  };

  const dark = theme === "dark";
  const Icon = dark ? Sun : Moon;
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      onClick={toggle}
      title={label}
      aria-label={label}
      className={clsx(
        "w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:bg-foreground/[0.06] hover:text-foreground transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        className
      )}
    >
      <Icon size={17} strokeWidth={1.75} />
    </button>
  );
}
