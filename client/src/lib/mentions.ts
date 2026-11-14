// Mentions are stored in text as @[Display Name](userId) (server: lib/mentions.ts). The editor
// shows them as @Name chips; these helpers convert between the stored and the shown text.

export type MentionRef = { id: string; name: string };
export type EntityType = "TASK" | "LEAD" | "PROJECT" | "KPI";

const TOKEN = /@\[([^\]\n]{1,100})\]\(([a-f0-9]{24})\)/gi;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Stored text → what the editor shows, plus the people mentioned in it. */
export function toDisplay(value: string | null | undefined): { text: string; mentions: MentionRef[] } {
  const mentions: MentionRef[] = [];
  const text = String(value ?? "").replace(TOKEN, (_all, name: string, id: string) => {
    if (!mentions.some((m) => m.id === id)) mentions.push({ id, name });
    return `@${name}`;
  });
  return { text, mentions };
}

/** What the editor shows → stored text. A chip whose @Name was deleted simply drops out. */
export function toValue(text: string, mentions: MentionRef[]): string {
  if (!mentions.length) return text;
  // Longest names first, so "@Ama Darko" wins over "@Ama".
  const byName = new Map<string, string>();
  for (const m of [...mentions].sort((a, b) => b.name.length - a.name.length)) if (!byName.has(m.name)) byName.set(m.name, m.id);
  const re = new RegExp(`@(${[...byName.keys()].map(escapeRe).join("|")})(?![\\w])`, "g");
  return text.replace(re, (_all, name: string) => `@[${name}](${byName.get(name)})`);
}

/** Splits stored text into plain runs and mentions, for rendering. */
export function segments(value: string | null | undefined): ({ text: string } | { mention: MentionRef })[] {
  const out: ({ text: string } | { mention: MentionRef })[] = [];
  const s = String(value ?? "");
  let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    if (m.index! > last) out.push({ text: s.slice(last, m.index) });
    out.push({ mention: { name: m[1], id: m[2] } });
    last = m.index! + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/** Stored text with mentions as plain @Name, for search and previews. */
export const plainText = (value: string | null | undefined) => toDisplay(value).text;

/** Where an entity opens in the app, with the comment to scroll to. Mirrors the server's links. */
export function entityPath(type: EntityType, id: string, commentId?: string | null): string {
  const base = type === "TASK" ? `/tasks?task=${id}` : type === "LEAD" ? `/leads?lead=${id}` : type === "PROJECT" ? `/projects/${id}` : `/kpi-framework?kpi=${id}`;
  return commentId ? `${base}${base.includes("?") ? "&" : "?"}comment=${commentId}` : base;
}

// ── Deep links ─────────────────────────────────────────────────────────────
// Pages read ?task= / ?lead= / ?kpi= / ?comment= from the URL when they mount. When the bell sends
// you to a page you're already on, Next doesn't remount it, so the bell fires this event too.

export const DEEP_LINK_EVENT = "trunqo:deeplink";

export function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

/** Calls back with the URL's query now and whenever the bell (or back/forward) changes it. */
export function onDeepLink(cb: (q: URLSearchParams) => void): () => void {
  const run = () => cb(new URLSearchParams(window.location.search));
  run();
  window.addEventListener(DEEP_LINK_EVENT, run);
  window.addEventListener("popstate", run);
  return () => { window.removeEventListener(DEEP_LINK_EVENT, run); window.removeEventListener("popstate", run); };
}

/** Removes params once they've been used, so a refresh doesn't reopen the same thing. */
export function clearParams(...names: string[]) {
  const url = new URL(window.location.href);
  let changed = false;
  for (const n of names) if (url.searchParams.has(n)) { url.searchParams.delete(n); changed = true; }
  if (changed) window.history.replaceState(window.history.state, "", url.pathname + (url.search ? url.search : "") + url.hash);
}
