"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { clsx } from "clsx";
import { ArrowUp, ArrowDown, Minus, Check, ChevronDown, Lock, type LucideIcon } from "lucide-react";
import { REVIEW_STYLE, REVIEW_LABEL, type ReviewStatus } from "./lib";

const pickerClass =
  "appearance-none bg-surface border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent";

// ─── Floating menu (fixed-position so table overflow never clips it) ────────
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
          className="z-50 bg-surface border border-border rounded-xl shadow-lg py-1"
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
        "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
        danger ? "text-red-600 hover:bg-red-500/10" : "text-foreground hover:bg-primary/5",
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {active && <Check size={14} className="text-accent" />}
    </button>
  );
}

export function Picker({ icon: Icon, value, onChange, children, className }: {
  icon: LucideIcon; value: string; onChange: (v: string) => void; children: ReactNode; className?: string;
}) {
  return (
    <div className="relative inline-block">
      <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className={clsx(pickerClass, className)}>
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>
  );
}

export function IconButton({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} title={title} className={clsx("p-1.5 rounded-lg text-muted transition-colors", danger ? "hover:text-red-600 hover:bg-red-500/10" : "hover:text-accent hover:bg-accent/10")}>
      {children}
    </button>
  );
}

export function ReviewBadge({ value }: { value: ReviewStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${REVIEW_STYLE[value] ?? REVIEW_STYLE.DRAFT}`}>
      {value === "LOCKED" && <Lock size={10} />}
      {REVIEW_LABEL[value] ?? value}
    </span>
  );
}

export function TrendCell({ trend }: { trend: string }) {
  if (trend === "IMPROVING") return <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium"><ArrowUp size={14} /> Improving</span>;
  if (trend === "NEEDS_ATTENTION") return <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium"><ArrowDown size={14} /> Slipping</span>;
  if (trend === "STABLE") return <span className="inline-flex items-center gap-1 text-muted text-xs font-medium"><Minus size={14} /> Steady</span>;
  return <span className="text-muted/50 text-xs">—</span>;
}
