"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { api, fetcher } from "@/lib/api";

// The "AI summary" card on the group, company and personal dashboards. The server writes the
// summary from the same numbers the dashboard shows and caches it; Refresh asks for a fresh
// write-up (the server rate-limits it). `fallback` is shown if the request fails.

type Summary = { summary: string; generatedAt: string; source: "ai" | "template" };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function AiSummaryCard({ endpoint, fallback }: { endpoint: string; fallback?: string }) {
  const qc = useQueryClient();
  const key = ["ai-summary", endpoint];
  const { data, isLoading, isError } = useQuery<Summary>({ queryKey: key, queryFn: () => fetcher(endpoint), staleTime: 5 * 60_000 });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await api.get<Summary>(`${endpoint}?refresh=1`);
      qc.setQueryData(key, r.data);
    } catch { /* keep what's shown */ }
    setRefreshing(false);
  };

  const text = data?.summary ?? (isError ? fallback : undefined);

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Sparkles size={13} strokeWidth={2.25} />
          </span>
          <h2 className="text-sm font-semibold text-foreground">AI summary</h2>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {data?.generatedAt && data.source === "ai" && <span className="text-[11px] text-muted">Updated {timeAgo(data.generatedAt)}</span>}
          <button
            onClick={refresh}
            disabled={refreshing || isLoading}
            className="text-[11px] font-semibold text-accent hover:underline disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {isLoading || refreshing ? (
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-accent/10" />
          <div className="h-3 w-5/6 animate-pulse rounded-full bg-accent/10" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-accent/10" />
        </div>
      ) : text ? (
        <p className="mt-3 text-sm leading-relaxed text-foreground/90">{text}</p>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          No summary available right now — check back once today&apos;s numbers are in.
        </p>
      )}
    </div>
  );
}
