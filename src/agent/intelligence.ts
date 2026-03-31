/**
 * intelligence.ts — Intelligence layer that enhances agent responses.
 *
 * Provides post-processing: topic extraction, sentiment analysis, action-item
 * detection, follow-up suggestions, conversation summaries, and escalation
 * detection. All logic is keyword / heuristic-based so it runs without
 * external API calls.
 */

import type { MemoryEntry } from "./memory.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntelligenceResult {
  response: string;
  topics: string[];
  sentiment: "positive" | "neutral" | "negative";
  actionItems: string[];
  suggestedFollowup: string[];
}

// ---------------------------------------------------------------------------
// Sentiment detection
// ---------------------------------------------------------------------------

const POSITIVE_WORDS = new Set([
  "great", "excellent", "good", "love", "happy", "thanks", "awesome",
  "perfect", "agreed", "done", "completed", "success", "shipped", "win",
  "improvement", "growth", "on track",
]);

const NEGATIVE_WORDS = new Set([
  "bug", "broken", "fail", "blocked", "issue", "problem", "error",
  "missed", "delay", "risk", "concern", "complaint", "down", "lost",
  "urgent", "critical", "escalate", "stuck", "overdue",
]);

export function detectSentiment(
  text: string,
): "positive" | "neutral" | "negative" {
  const lower = text.toLowerCase();
  let score = 0;

  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) score += 1;
  }
  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) score -= 1;
  }

  if (score >= 2) return "positive";
  if (score <= -2) return "negative";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Topic extraction
// ---------------------------------------------------------------------------

const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "is", "it", "this", "that", "we", "i", "you",
  "our", "my", "do", "be", "have", "has", "not", "so", "if", "was",
  "are", "can", "will", "just", "from", "about",
]);

export function extractKeyTopics(text: string): string[] {
  const freq = new Map<string, number>();
  const words = text.toLowerCase().split(/\W+/);

  for (const w of words) {
    if (w.length < 3 || STOP.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

// ---------------------------------------------------------------------------
// Action item extraction
// ---------------------------------------------------------------------------

const ACTION_PATTERNS = [
  /(?:need to|needs to|must|should|please|todo|to-do|action item)[\s:]+(.+)/gi,
  /(?:follow.?up|deadline|assign|owner)[\s:]*(.+)/gi,
  /(?:let'?s|we(?:'ll| will)|going to)\s+(.+)/gi,
];

export function extractActionItems(text: string): string[] {
  const items: string[] = [];

  for (const pattern of ACTION_PATTERNS) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      const item = match[1].trim().replace(/[.!;]+$/, "");
      if (item.length > 5 && item.length < 200) {
        items.push(item);
      }
    }
  }

  // Deduplicate.
  return Array.from(new Set(items));
}

// ---------------------------------------------------------------------------
// Follow-up generation
// ---------------------------------------------------------------------------

export function generateFollowup(
  topics: string[],
  sentiment: string,
): string[] {
  const followups: string[] = [];

  for (const topic of topics.slice(0, 3)) {
    followups.push(`What is the current status of ${topic}?`);
  }

  if (sentiment === "negative") {
    followups.push("Is there anything blocking progress that I should know about?");
  }

  if (sentiment === "positive") {
    followups.push("What contributed most to this success?");
  }

  if (followups.length === 0) {
    followups.push("Is there anything else you would like to discuss?");
  }

  return followups;
}

// ---------------------------------------------------------------------------
// Conversation summary
// ---------------------------------------------------------------------------

export function summarizeConversation(messages: MemoryEntry[]): string {
  if (messages.length === 0) return "Empty conversation.";

  const userMsgs = messages.filter((m) => m.role === "user");
  const topics = extractKeyTopics(
    userMsgs.map((m) => m.content).join(" "),
  );

  const firstTs = messages[0].timestamp;
  const lastTs = messages[messages.length - 1].timestamp;
  const summaryParts = [
    `Conversation spanning ${firstTs} to ${lastTs}`,
    `${messages.length} messages (${userMsgs.length} from user)`,
  ];

  if (topics.length > 0) {
    summaryParts.push(`Key topics: ${topics.join(", ")}`);
  }

  const sentiment = detectSentiment(
    messages.map((m) => m.content).join(" "),
  );
  summaryParts.push(`Overall sentiment: ${sentiment}`);

  return summaryParts.join(". ") + ".";
}

// ---------------------------------------------------------------------------
// Escalation detection
// ---------------------------------------------------------------------------

const ESCALATION_KEYWORDS = [
  "urgent", "critical", "emergency", "escalate", "executive",
  "legal", "compliance", "breach", "outage", "data loss",
  "security incident", "cannot access", "system down",
];

export function shouldEscalate(message: string): boolean {
  const lower = message.toLowerCase();
  return ESCALATION_KEYWORDS.some((kw) => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// Full analysis
// ---------------------------------------------------------------------------

export function analyzeResponse(content: string): IntelligenceResult {
  const topics = extractKeyTopics(content);
  const sentiment = detectSentiment(content);
  const actionItems = extractActionItems(content);
  const suggestedFollowup = generateFollowup(topics, sentiment);

  return {
    response: content,
    topics,
    sentiment,
    actionItems,
    suggestedFollowup,
  };
}
