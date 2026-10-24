"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AlertTriangle, Building2, ChevronRight, Lock, UserRound } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { STATUS_LABEL } from "./lib";

/** A business that may already be in the system (GET /leads/duplicates). */
export type DuplicateMatch = {
  kind: "LEAD" | "CLIENT";
  /** Null when the caller can't open it (someone else's private lead). */
  id: string | null;
  name: string;
  match: "same" | "similar";
  company: string | null;
  owner: string | null;
  status: string | null;
  converted?: boolean;
  restricted: boolean;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Leads and clients whose name matches what's being typed, checked as you type. */
export function useDuplicateMatches(name: string, excludeId?: string | null) {
  const q = useDebounced(name.trim(), 350);
  const { data = [], isFetching } = useQuery<DuplicateMatch[]>({
    queryKey: ["lead-duplicates", q, excludeId ?? ""],
    queryFn: () => fetcher(`/leads/duplicates?${new URLSearchParams({ name: q, ...(excludeId ? { excludeId } : {}) })}`),
    enabled: q.length >= 3,
    staleTime: 30_000,
  });
  return { matches: q.length >= 3 ? data : [], checking: isFetching };
}

/**
 * The matches, worded for someone about to add a lead: same-name leads first. Leads the person
 * can open are clickable; a colleague's private lead shows only who has it.
 */
export function DuplicateMatches({ matches, onOpenLead, title }: {
  matches: DuplicateMatch[];
  onOpenLead?: (id: string) => void;
  title?: string;
}) {
  const { byKey } = useCompanies();
  if (!matches.length) return null;
  const same = matches.some((m) => m.match === "same" && m.kind === "LEAD" && !m.converted);

  return (
    <div className={clsx("rounded-xl border px-3.5 py-3", same ? "border-amber-300 bg-amber-50/70" : "border-border bg-background")}>
      <p className={clsx("mb-2 flex items-center gap-1.5 text-xs font-semibold", same ? "text-amber-800" : "text-muted")}>
        <AlertTriangle size={13} />
        {title ?? (same ? "This business may already be a lead" : "Similar businesses already in the system")}
      </p>
      <ul className="space-y-1.5">
        {matches.map((m, i) => {
          const openable = m.kind === "LEAD" && !!m.id && !!onOpenLead;
          const company = m.company ? (byKey[m.company]?.name ?? m.company) : null;
          const what = m.kind === "CLIENT" ? "Client" : m.converted ? "Converted lead" : `Lead · ${STATUS_LABEL[m.status ?? ""] ?? m.status ?? ""}`;
          const body = (
            <>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-muted border border-border">
                {m.kind === "CLIENT" ? <Building2 size={13} /> : m.restricted ? <Lock size={13} /> : <UserRound size={13} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
                  <span className={clsx("shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                    m.match === "same" ? "bg-amber-100 text-amber-800" : "bg-subtle text-muted")}>
                    {m.match === "same" ? "Same name" : "Similar"}
                  </span>
                </span>
                <span className="block truncate text-xs text-muted">
                  {[what, company, m.owner ? `owned by ${m.owner}` : "no owner yet"].filter(Boolean).join(" · ")}
                </span>
                {!m.restricted && (m.contactPerson || m.phone || m.email) && (
                  <span className="block truncate text-xs text-muted">{[m.contactPerson, m.phone, m.email].filter(Boolean).join(" · ")}</span>
                )}
                {m.restricted && m.kind === "LEAD" && (
                  <span className="block text-xs text-muted">Private to {m.owner ?? "its owner"}. Ask them before adding it again.</span>
                )}
              </span>
              {openable && <ChevronRight size={14} className="shrink-0 text-muted" />}
            </>
          );
          return (
            <li key={`${m.kind}-${m.id ?? i}`}>
              {openable ? (
                <button type="button" onClick={() => onOpenLead!(m.id!)} className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-surface">
                  {body}
                </button>
              ) : (
                <div className="flex items-center gap-2.5 px-1 py-1">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
