/**
 * context.ts — Context builder for the business agent.
 *
 * Assembles the full AgentContext from KV data: user profile, team info,
 * recent conversation topics, and business metrics.
 */

import type { MemoryEntry, Conversation } from "./memory.js";
import { getConversation, listConversations } from "./memory.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentContext {
  userId: string;
  userName: string;
  userRole: string;
  teamName: string;
  channel: string;
  conversationId: string;
  recentTopics: string[];
  businessMetrics?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// KV keys
// ---------------------------------------------------------------------------

function userProfileKey(userId: string): string {
  return `user:${userId}:profile`;
}

const BUSINESS_METRICS_KEY = "business:metrics";

// ---------------------------------------------------------------------------
// Topic extraction (simple keyword-based)
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "is", "it", "this", "that", "we", "i", "you",
  "our", "my", "do", "be", "have", "has", "not", "so", "if", "as",
  "was", "are", "can", "will", "just", "from", "about", "would", "could",
]);

/** Extract candidate topics from an array of messages. */
export function extractTopics(messages: MemoryEntry[]): string[] {
  const freq = new Map<string, number>();

  for (const msg of messages) {
    const words = msg.content.toLowerCase().split(/\W+/);
    for (const word of words) {
      if (word.length < 3 || STOP_WORDS.has(word)) continue;
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Serialise context for injection into a system prompt. */
export function formatContextForPrompt(context: AgentContext): string {
  const lines: string[] = [
    `Team: ${context.teamName}`,
    `User: ${context.userName} (${context.userRole})`,
    `Channel: ${context.channel}`,
    `Conversation: ${context.conversationId}`,
  ];

  if (context.recentTopics.length > 0) {
    lines.push(`Recent topics: ${context.recentTopics.join(", ")}`);
  }

  if (context.businessMetrics) {
    const pairs = Object.entries(context.businessMetrics)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    lines.push(`Metrics: ${pairs}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Business metrics
// ---------------------------------------------------------------------------

/** Pull aggregated business metrics from KV. */
export async function getBusinessSummary(
  kv: KVNamespace,
): Promise<Record<string, number>> {
  const raw = await kv.get(BUSINESS_METRICS_KEY, "text");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Full context builder
// ---------------------------------------------------------------------------

/**
 * Assemble the complete AgentContext for a user and conversation.
 * Falls back to sensible defaults when profile or conversation data is absent.
 */
export async function buildContext(
  kv: KVNamespace,
  userId: string,
  conversationId: string,
): Promise<AgentContext> {
  // Load user profile.
  const profileRaw = await kv.get(userProfileKey(userId), "text");
  const profile = profileRaw
    ? (JSON.parse(profileRaw) as {
        name?: string;
        role?: string;
        team?: string;
      })
    : {};

  // Load conversation for topics and channel.
  const conv: Conversation | null = await getConversation(kv, userId, conversationId);
  const recentTopics = conv ? extractTopics(conv.messages.slice(-20)) : [];

  const metrics = await getBusinessSummary(kv);

  return {
    userId,
    userName: profile.name ?? "User",
    userRole: profile.role ?? "member",
    teamName: profile.team ?? "Default Team",
    channel: conv?.channel ?? "general",
    conversationId,
    recentTopics,
    businessMetrics: Object.keys(metrics).length > 0 ? metrics : undefined,
  };
}
