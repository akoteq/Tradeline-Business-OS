// One-to-one chat (docs/chat/README.md): types, cache keys, and a small live store for who's
// online, who's typing, and which chat is on screen.

export type ChatPerson = { id: string; name: string; email: string; company: string | null; role: string };

export type ChatAttachment = { name: string; url: string; publicId: string; resourceType: string | null; fileType: string | null; fileSize: number | null };

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  attachments: ChatAttachment[];
  editedAt: string | null;
  deletedAt: string | null;
  deleted: boolean;
  createdAt: string;
};

export type ChatConversation = {
  id: string;
  other: ChatPerson;
  lastMessageAt: string | null;
  lastPreview: string | null;
  lastSenderId: string | null;
  unread: number;
  muted: boolean;
  lastReadAt: string | null;
  otherLastReadAt: string | null;
  createdAt: string;
  canSend?: boolean;
};

export type MessagesPage = { messages: ChatMessage[]; hasMore: boolean };

export const chatKeys = {
  list: ["chat", "list"] as const,
  count: ["chat", "count"] as const,
  conversation: (id: string) => ["chat", "conversation", id] as const,
  messages: (id: string) => ["chat", "messages", id] as const,
};

export const messagesPath = (conversationId?: string | null) => (conversationId ? `/messages?c=${conversationId}` : "/messages");

// ── Live store ──────────────────────────────────────────────────────────────

type State = { online: Set<string>; typing: Map<string, number>; active: string | null };
let state: State = { online: new Set(), typing: new Map(), active: null };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };

export const chatStore = {
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  get: () => state,
  setOnline(userId: string, online: boolean) {
    const next = new Set(state.online);
    if (online) next.add(userId); else next.delete(userId);
    set({ online: next });
  },
  addOnline(userIds: string[]) { set({ online: new Set([...state.online, ...userIds]) }); },
  /** Someone is typing in a chat; it lapses after a few seconds unless renewed. */
  setTyping(conversationId: string, typing: boolean) {
    const next = new Map(state.typing);
    if (typing) next.set(conversationId, Date.now() + 6000); else next.delete(conversationId);
    set({ typing: next });
  },
  /** The chat on screen, so a new message there isn't toasted and is marked read. */
  setActive(conversationId: string | null) { if (state.active !== conversationId) set({ active: conversationId }); },
};

export const isTyping = (s: State, conversationId: string) => (s.typing.get(conversationId) ?? 0) > Date.now();

export function fileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const isImage = (a: Pick<ChatAttachment, "fileType" | "resourceType">) => (a.fileType ?? "").startsWith("image/");
