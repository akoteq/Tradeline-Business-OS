"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { clsx } from "clsx";
import { Check } from "lucide-react";

// Floating menu (fixed-position so table and card overflow never clips it).
export function Menu({ width = 192, trigger, children }: {
  width?: number;
  trigger: (p: { toggle: () => void; open: boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || wrapRef.current?.contains(t)) return;
      setPos(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    const onMove = () => setPos(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [pos]);

  const toggle = () => {
    if (pos) { setPos(null); return; }
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width));
    const room = window.innerHeight - r.bottom;
    setPos(room < 260 ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 });
  };

  return (
    <>
      <span ref={wrapRef} className="inline-flex">{trigger({ toggle, open: !!pos })}</span>
      {pos && (
        <div
          ref={menuRef}
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width }}
          className="z-50 rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {children(close)}
        </div>
      )}
    </>
  );
}

export function MenuItem({ icon, active, danger, onClick, children }: {
  icon?: ReactNode; active?: boolean; danger?: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
        danger ? "text-red-600 hover:bg-red-500/10" : "text-foreground hover:bg-subtle/50",
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {active && <Check size={14} className="text-accent" />}
    </button>
  );
}
