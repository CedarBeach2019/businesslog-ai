/**
 * memory.ts — KV-backed multi-user isolated memory.
 *
 * Every KV key is prefixed with `mem:${userId}:` so that conversations are
 * strictly scoped to a single user. No cross-user data can leak.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemoryEntry {
  id: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: MemoryEntry[];
  createdAt: string;
  updatedAt: string;
  channel?: string;
}

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

/** Namespace-isolated key for a conversation object. */
export function keyFor(userId: string, conversationId: string): string {
  return `mem:${userId}:conv:${conversationId}`;
}

/** Key for the user's conversation index. */
function indexKey(userId: string): string {
  return `mem:${userId}:index`;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Append a message to an existing conversation and persist it. */
export async function saveMessage(
  kv: KVNamespace,
  userId: string,
  conversationId: string,
  entry: MemoryEntry,
): Promise<void> {
  const conv = await getConversation(kv, userId, conversationId);
  if (!conv) {
    return;
  }
  conv.messages.push(entry);
  conv.updatedAt = new Date().toISOString();
  await kv.put(keyFor(userId, conversationId), JSON.stringify(conv));
}

/** Retrieve a full conversation, or null if it does not exist. */
export async function getConversation(
  kv: KVNamespace,
  userId: string,
  conversationId: string,
): Promise<Conversation | null> {
  const raw = await kv.get(keyFor(userId, conversationId), "text");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Conversation;
  } catch {
    return null;
  }
}

/** List conversations for a user, ordered by most recently updated. */
export async function listConversations(
  kv: KVNamespace,
  userId: string,
  limit: number = 50,
): Promise<Conversation[]> {
  const raw = await kv.get(indexKey(userId), "text");
  if (!raw) return [];

  try {
    const ids: string[] = JSON.parse(raw);
    const convos: Conversation[] = [];

    // Resolve in parallel, but cap at limit.
    const slice = ids.slice(0, limit);
    const results = await Promise.all(
      slice.map((id) => kv.get(keyFor(userId, id), "text")),
    );

    for (const data of results) {
      if (data) {
        convos.push(JSON.parse(data) as Conversation);
      }
    }

    convos.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return convos;
  } catch {
    return [];
  }
}

/** Create a brand-new conversation and add it to the user's index. */
export async function createConversation(
  kv: KVNamespace,
  userId: string,
  channel?: string,
): Promise<Conversation> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const conv: Conversation = {
    id,
    userId,
    title: "New conversation",
    messages: [],
    createdAt: now,
    updatedAt: now,
    channel,
  };

  await kv.put(keyFor(userId, id), JSON.stringify(conv));

  // Update index — prepend new id.
  const raw = await kv.get(indexKey(userId), "text");
  const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  ids.unshift(id);
  await kv.put(indexKey(userId), JSON.stringify(ids));

  return conv;
}

/** Delete a conversation and remove it from the user's index. */
export async function deleteConversation(
  kv: KVNamespace,
  userId: string,
  conversationId: string,
): Promise<void> {
  await kv.delete(keyFor(userId, conversationId));

  const raw = await kv.get(indexKey(userId), "text");
  if (raw) {
    const ids: string[] = JSON.parse(raw);
    const filtered = ids.filter((id) => id !== conversationId);
    await kv.put(indexKey(userId), JSON.stringify(filtered));
  }
}

// ---------------------------------------------------------------------------
// Search & context
// ---------------------------------------------------------------------------

/** Naive substring search across all of a user's conversations. */
export async function searchMemory(
  kv: KVNamespace,
  userId: string,
  query: string,
): Promise<MemoryEntry[]> {
  const convos = await listConversations(kv, userId);
  const lower = query.toLowerCase();
  const matches: MemoryEntry[] = [];

  for (const conv of convos) {
    for (const msg of conv.messages) {
      if (msg.content.toLowerCase().includes(lower)) {
        matches.push(msg);
      }
    }
  }

  return matches;
}

/** Return the most recent N messages across all conversations for context. */
export async function getRecentContext(
  kv: KVNamespace,
  userId: string,
  limit: number = 20,
): Promise<MemoryEntry[]> {
  const convos = await listConversations(kv, userId);
  const all: MemoryEntry[] = [];

  for (const conv of convos) {
    all.push(...conv.messages);
  }

  all.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return all.slice(0, limit);
}
