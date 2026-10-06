"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Plus, Trash2, ChevronLeft } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isManager } from "@/lib/auth";
import { useCompanies } from "@/lib/companies";
import {
  KpiStatus, KPI_STATUS_LIST, KPI_STATUS_STYLE, KPI_STATUS_LABEL, KPI_STATUS_HINT,
  fmtKpiVal, PaceBar, AutoTag, KpiSheet,
} from "@/components/kpi";

// ─── Types ──────────────────────────────────────────────────────────────────
type Def = {
  id: string; metric: string; unit: string; higherIsBetter: boolean; definition: string | null;
  source: string; autoKey: string | null; assignedBy: string | null; ownerBdoId: string | null;
};
type Entry = { id: string; current: number | null; target: number | null; start: number | null; reviewStatus: string };
type Row = {
  definition: Def; entry: Entry | null;
  current: number | null; target: number | null; attainment: number | null; expected: number | null;
  status: KpiStatus; kind: "PERSONAL" | "STANDARD"; canManage: boolean;
};
type MyKpis = { owner: { id: string; name: string; company: string }; rows: Row[] };
type AutoKey = { key: string; label: string; unit: string; kind: string; personal: boolean };
type Bdo = { id: string; name: string; company: string };
type TeamRow = {
  person: { id: string; name: string; company: string; title: string | null };
  counts: Partial<Record<KpiStatus, number>>; personalCount: number; tracked: number;
};
type AuditLog = { id: string; action: string; field: string | null; previousValue: string | null; newValue: string | null; note: string | null; actorEmail: string | null; createdAt: string };

const UNIT_CHOICES = [["COUNT", "Number"], ["CURRENCY", "GHS"], ["PERCENT", "%"]] as const;

const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-60";
const selectClass =
  "text-sm bg-background border border-border rounded-lg px-2 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40";
const btnSecondary = "px-4 py-2 text-sm text-foreground rounded-lg border border-border hover:bg-primary/5 transition-colors disabled:opacity-50";
const btnPrimary = "px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity";

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// Days left in the selected month, or null when it isn't the current month.
function daysLeft(period: string): number | null {
  const now = new Date();
  if (now.toISOString().slice(0, 7) !== period) return null;
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted block mb-1">{children}</label>;
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-lg">{message}</p>;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden text-sm">
      {options.map(([key, label], i) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={clsx(
            "flex-1 px-3 py-2 transition-colors",
            i > 0 && "border-l border-border",
            value === key ? "bg-primary text-accent-foreground" : "bg-background text-foreground/70 hover:bg-primary/5",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
// view: "team" (managers' overview), "me", or a staff profile id.
export default function MyKpisPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Mirrors KPI_ASSIGNER_ROLES in server/src/routes/kpiFramework.ts: Group Owner or Business CEO.
  const canAssign = isManager(user);
  const hasProfile = !!user?.bdoId;

  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [view, setView] = useState<string>(""); // "" = default for the role
  const [updateRow, setUpdateRow] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);

  const current = view || (canAssign ? "team" : "me");
  const isTeam = current === "team";
  const personId = isTeam || current === "me" ? null : current;
  const viewingSomeoneElse = !!personId && personId !== user?.bdoId;
  // Staff whose login has no staff profile have nothing to track yet.
  const unlinked = !isTeam && !personId && !hasProfile;

  const { data: people = [] } = useQuery<Bdo[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
    enabled: canAssign,
  });

  const { data: team = [], isLoading: teamLoading, error: teamError } = useQuery<TeamRow[]>({
    queryKey: ["kpi-team", period],
    queryFn: () => fetcher(`/kpi-framework/team?period=${period}`),
    enabled: canAssign && isTeam,
  });

  const qp = new URLSearchParams({ period });
  if (personId) qp.set("bdoId", personId);
  const { data, isLoading, error } = useQuery<MyKpis>({
    queryKey: ["my-kpis", period, personId ?? "me"],
    queryFn: () => fetcher(`/kpi-framework/my?${qp}`),
    enabled: !!user && !isTeam && !unlinked,
  });
  const rows = data?.rows ?? [];
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["my-kpis"] }); qc.invalidateQueries({ queryKey: ["kpi-team"] }); };

  const quickAdd = useMutation({
    mutationFn: (r: Row) => api.post("/kpi-framework/quick-update", { definitionId: r.definition.id, period, delta: 1, bdoId: data?.owner.id }),
    onSuccess: invalidate,
    onError: (err) => window.alert(apiError(err, "Couldn't update the KPI.")),
  });

  const counts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const left = daysLeft(period);
  const title = isTeam ? "Team KPIs" : viewingSomeoneElse && data ? `${data.owner.name}'s KPIs` : "My KPIs";
  const canCreate = !isTeam && !!data;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">Performance</p>
          {canAssign && !isTeam && (
            <button onClick={() => setView("team")} className="text-xs text-muted hover:text-accent transition-colors mb-1 inline-flex items-center gap-1">
              <ChevronLeft size={13} /> Team
            </button>
          )}
          <h1 className="font-serif text-2xl md:text-3xl text-foreground">{title}</h1>
          <p className="text-sm text-muted mt-1">
            {periodLabel(period)}{left != null && <> · {left} day{left === 1 ? "" : "s"} left</>}.{" "}
            {isTeam ? "People who need attention are listed first." : "The tick on each bar is where you should be by today."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canAssign && (
            <select value={current} onChange={(e) => setView(e.target.value)} className={selectClass}>
              <option value="team">Whole team</option>
              {hasProfile && <option value="me">Me</option>}
              {people.filter((p) => p.id !== user?.bdoId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <input type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} className={selectClass} />
          {canCreate && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity">
              <Plus size={15} /> {viewingSomeoneElse ? "Assign KPI" : "New KPI"}
            </button>
          )}
        </div>
      </div>

      {isTeam ? (
        teamLoading ? <Empty text="Loading team…" />
        : teamError ? <Empty text={apiError(teamError, "Couldn't load the team.")} />
        : team.length === 0 ? <Empty text="No staff profiles yet. Add people in Team & Access." />
        : <TeamGrid team={team} onOpen={(id) => setView(id)} />
      ) : (
        <>
          {rows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {KPI_STATUS_LIST.filter((s) => counts[s]).map((s) => (
                <span key={s} title={KPI_STATUS_HINT[s]} className={`px-2.5 py-1 rounded-full text-xs font-medium ${KPI_STATUS_STYLE[s]}`}>
                  {counts[s]} {KPI_STATUS_LABEL[s]}
                </span>
              ))}
            </div>
          )}

          {unlinked ? (
            <Empty text="Your login isn't linked to a staff profile yet, so there are no KPIs to track. Ask a Group Owner to link it in Team & Access." />
          ) : isLoading ? (
            <Empty text="Loading…" />
          ) : error ? (
            <Empty text={apiError(error, "Couldn't load KPIs.")} />
          ) : rows.length === 0 ? (
            <Empty text="No KPIs yet. Create one: a title, a target, and you're done." action={<button onClick={() => setCreating(true)} className="mt-3 text-sm font-medium text-accent hover:underline">Create the first KPI</button>} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rows.map((r) => (
                <KpiCard
                  key={r.definition.id}
                  row={r}
                  onUpdate={() => setUpdateRow(r)}
                  onPlusOne={() => quickAdd.mutate(r)}
                  busy={quickAdd.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}

      {updateRow && (
        <UpdateSheet row={updateRow} period={period} bdoId={data?.owner.id ?? null} onClose={() => setUpdateRow(null)} onSaved={invalidate} />
      )}
      {creating && data && (
        <CreateSheet
          ownerId={data.owner.id}
          ownerName={viewingSomeoneElse ? data.owner.name : null}
          period={period}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); invalidate(); }}
        />
      )}
    </div>
  );
}

// Managers' overview: one card per person with their status counts.
function TeamGrid({ team, onOpen }: { team: TeamRow[]; onOpen: (id: string) => void }) {
  const { byKey } = useCompanies();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {team.map((t) => {
        const statuses = KPI_STATUS_LIST.filter((s) => s !== "NO_TARGET" && t.counts[s]);
        return (
          <button
            key={t.person.id}
            onClick={() => onOpen(t.person.id)}
            className="text-left rounded-xl border border-border bg-surface p-4 flex flex-col gap-3 hover:border-accent/40 transition-colors"
          >
            <div className="min-w-0">
              <div className="font-medium text-foreground truncate">{t.person.name}</div>
              <div className="text-xs text-muted truncate">
                {[t.person.title, byKey[t.person.company]?.name ?? t.person.company].filter(Boolean).join(" · ")}
              </div>
            </div>
            {statuses.length ? (
              <div className="flex flex-wrap gap-1.5">
                {statuses.map((s) => (
                  <span key={s} className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${KPI_STATUS_STYLE[s]}`}>
                    {t.counts[s]} {KPI_STATUS_LABEL[s]}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted">No targets set this month</span>
            )}
            <span className="text-xs text-muted mt-auto">
              {t.personalCount ? `${t.personalCount} personal KPI${t.personalCount === 1 ? "" : "s"} · ` : ""}View KPIs →
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center">
      <p className="text-muted">{text}</p>
      {action}
    </div>
  );
}

function KpiCard({ row, onUpdate, onPlusOne, busy }: { row: Row; onUpdate: () => void; onPlusOne: () => void; busy: boolean }) {
  const { definition: d, current, target, status } = row;
  const isAuto = d.source === "AUTO";
  const locked = row.entry?.reviewStatus === "LOCKED";
  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-foreground leading-snug">{d.metric}</div>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {isAuto && <AutoTag />}
            {d.assignedBy && <Tag>Assigned</Tag>}
            {row.kind === "STANDARD" && <Tag>Scorecard</Tag>}
            {!d.higherIsBetter && <Tag>Decrease</Tag>}
          </div>
        </div>
        <span title={KPI_STATUS_HINT[status]} className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${KPI_STATUS_STYLE[status]}`}>
          {KPI_STATUS_LABEL[status]}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold text-foreground tabular-nums">{fmtKpiVal(current, d.unit)}</span>
        <span className="text-sm text-muted tabular-nums">/ {fmtKpiVal(target, d.unit)}</span>
      </div>

      <div className="flex items-center gap-2">
        <PaceBar attainment={row.attainment} expected={row.expected} status={status} className="h-2" />
        <span className="text-xs tabular-nums text-muted w-9 text-right">{row.attainment != null ? `${row.attainment}%` : "—"}</span>
      </div>

      <div className="flex items-center gap-2 mt-auto pt-1">
        {!isAuto && d.unit === "COUNT" && !locked && (
          <button onClick={onPlusOne} disabled={busy} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-foreground hover:border-accent hover:text-accent transition-colors disabled:opacity-50">
            +1
          </button>
        )}
        <button onClick={onUpdate} className="flex-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary/5 text-foreground hover:bg-primary/10 transition-colors">
          {isAuto ? "Set target" : "Update"}
        </button>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="text-[9px] font-semibold uppercase tracking-wider bg-foreground/5 text-foreground/60 px-1.5 py-0.5 rounded">{children}</span>;
}

// ─── Update: set value / add, target, start, note ───────────────────────────
function UpdateSheet({ row, period, bdoId, onClose, onSaved }: { row: Row; period: string; bdoId: string | null; onClose: () => void; onSaved: () => void }) {
  const d = row.definition;
  const isAuto = d.source === "AUTO";
  const locked = row.entry?.reviewStatus === "LOCKED";
  const [value, setValue] = useState(row.current != null && !isAuto ? String(row.current) : "");
  const [target, setTarget] = useState(row.target != null ? String(row.target) : "");
  const [start, setStart] = useState(row.entry?.start != null ? String(row.entry.start) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { data: audit = [] } = useQuery<AuditLog[]>({
    queryKey: ["kpi-audit", row.entry?.id],
    queryFn: () => fetcher(`/kpi-framework/entries/${row.entry!.id}/audit`),
    enabled: !!row.entry,
  });

  const save = async () => {
    setBusy(true); setError("");
    const body: Record<string, unknown> = { definitionId: d.id, period, bdoId, note: note || undefined, target, start };
    if (!isAuto && value !== "" && Number(value) !== row.current) body.value = value;
    try {
      await api.post("/kpi-framework/quick-update", body);
      onSaved();
      onClose();
    } catch (err) {
      setError(apiError(err, "Failed to save."));
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Remove "${d.metric}"? Its history is kept.`)) return;
    setBusy(true); setError("");
    try {
      await api.delete(`/kpi-framework/my/${d.id}`);
      onSaved();
      onClose();
    } catch (err) {
      setError(apiError(err, "Failed to remove."));
      setBusy(false);
    }
  };

  return (
    <KpiSheet
      title={<>{d.metric}{isAuto && <AutoTag />}</>}
      subtitle={`${periodLabel(period)} · ${KPI_STATUS_LABEL[row.status]}`}
      onClose={onClose}
      footer={
        <>
          {row.canManage && (
            <button onClick={remove} disabled={busy} className="mr-auto p-2 rounded-lg text-muted hover:text-red-600 hover:bg-red-500/10 transition-colors" title="Remove KPI">
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={save} disabled={busy || locked} className={btnPrimary}>{busy ? "Saving…" : "Save"}</button>
        </>
      }
    >
      {d.definition && <p className="text-xs text-muted bg-background border border-border rounded-lg p-3 leading-relaxed">{d.definition}</p>}
      {locked && <p className="text-xs text-foreground bg-foreground/5 rounded-lg px-3 py-2">This scorecard is locked. An admin must reopen it before values can change.</p>}

      {isAuto ? (
        <p className="text-[11px] text-sky-700 bg-sky-500/5 rounded-lg px-3 py-2">
          Current value <strong>{fmtKpiVal(row.current, d.unit)}</strong> is calculated live from your records. Just set the target.
        </p>
      ) : (
        <div>
          <Label>Current value</Label>
          <input type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} disabled={locked} className={inputClass + " text-lg tabular-nums"} autoFocus />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Target</Label>
          <input type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} disabled={locked} className={inputClass} />
        </div>
        <div>
          <Label>Start value <span className="text-muted/60">(optional)</span></Label>
          <input type="number" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} disabled={locked} className={inputClass} />
        </div>
      </div>

      {!isAuto && (
        <div>
          <Label>Note <span className="text-muted/60">(optional)</span></Label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="e.g. 3 calls with Kumasi SMEs" maxLength={140} />
        </div>
      )}

      <ErrorNote message={error} />

      {audit.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted mb-2">History</p>
          <ul className="space-y-1.5 max-h-36 overflow-y-auto border-l border-border pl-3">
            {audit.slice(0, 12).map((l) => (
              <li key={l.id} className="text-[11px] text-muted">
                <span className="text-muted/60 mr-2">{new Date(l.createdAt).toLocaleDateString()}</span>
                {l.field ? <>{l.field}: {l.previousValue || "—"} → <span className="text-foreground">{l.newValue || "—"}</span></> : l.action.replace(/_/g, " ")}
                {l.note && <span className="italic"> · {l.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </KpiSheet>
  );
}

// ─── Create: title, target, unit, direction, source ─────────────────────────
function CreateSheet({ ownerId, ownerName, period, onClose, onSaved }: {
  ownerId: string; ownerName: string | null; period: string; onClose: () => void; onSaved: () => void;
}) {
  const { data: autoKeys = [] } = useQuery<AutoKey[]>({ queryKey: ["kpi-auto-keys"], queryFn: () => fetcher("/kpi-framework/auto-keys") });
  const suggestions = autoKeys.filter((k) => k.personal && k.kind === "PERIOD");
  const otherFeeds = autoKeys.filter((k) => k.personal && k.kind !== "PERIOD");

  const [metric, setMetric] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState<string>("COUNT");
  const [direction, setDirection] = useState<"UP" | "DOWN">("UP");
  const [start, setStart] = useState("");
  const [autoKey, setAutoKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickFeed = (key: string) => {
    const k = autoKeys.find((a) => a.key === key);
    setAutoKey(key);
    if (k) {
      setUnit(k.unit);
      setDirection("UP");
      if (!metric.trim()) setMetric(k.label.replace(/\s*\(.*\)$/, ""));
    }
  };

  const save = async () => {
    if (!metric.trim()) { setError("Give the KPI a title."); return; }
    if (target === "") { setError("Set a target."); return; }
    if (direction === "DOWN" && start === "") { setError("For a decrease, enter where it starts from."); return; }
    setBusy(true); setError("");
    try {
      await api.post("/kpi-framework/my", {
        metric, target, unit, period,
        higherIsBetter: direction === "UP",
        start: direction === "DOWN" ? start : null,
        source: autoKey ? "AUTO" : "MANUAL",
        autoKey: autoKey || null,
        ownerBdoId: ownerId,
      });
      onSaved();
    } catch (err) {
      setError(apiError(err, "Failed to create KPI."));
    } finally { setBusy(false); }
  };

  return (
    <KpiSheet
      title={ownerName ? `Assign a KPI to ${ownerName}` : "New KPI"}
      subtitle={`Tracked for ${periodLabel(period)}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving…" : ownerName ? "Assign" : "Create"}</button>
        </>
      }
    >
      {suggestions.length > 0 && (
        <div>
          <Label>Fills itself from your records</Label>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => (autoKey === k.key ? setAutoKey("") : pickFeed(k.key))}
                className={clsx(
                  "px-2.5 py-1 rounded-full text-xs border transition-colors",
                  autoKey === k.key ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground/70 hover:border-accent/40",
                )}
              >
                {k.label.replace(/\s*\(.*\)$/, "")}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label>Title *</Label>
        <input value={metric} onChange={(e) => setMetric(e.target.value)} className={inputClass} placeholder="e.g. Make 40 calls" autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Target *</Label>
          <input type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} />
        </div>
        <div>
          <Label>Unit</Label>
          <Segmented value={unit as "COUNT"} options={UNIT_CHOICES} onChange={(v) => setUnit(v)} />
        </div>
      </div>

      {!autoKey && (
        <>
          <div>
            <Label>Direction</Label>
            <Segmented value={direction} options={[["UP", "Increase"], ["DOWN", "Decrease"]] as const} onChange={setDirection} />
          </div>
          {direction === "DOWN" && (
            <div>
              <Label>Starting from *</Label>
              <input type="number" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} placeholder="e.g. 4000" />
            </div>
          )}
        </>
      )}

      {otherFeeds.length > 0 && (
        <div>
          <Label>Or track a running total</Label>
          <select value={suggestions.some((k) => k.key === autoKey) ? "" : autoKey} onChange={(e) => (e.target.value ? pickFeed(e.target.value) : setAutoKey(""))} className={selectClass + " w-full"}>
            <option value="">Manual — I&apos;ll update it myself</option>
            {otherFeeds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </div>
      )}

      <ErrorNote message={error} />
    </KpiSheet>
  );
}
