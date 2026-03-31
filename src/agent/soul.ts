/**
 * soul.ts — Business agent soul definition and system prompt builder.
 *
 * The soul encodes the agent's personality, tone, and capabilities.
 * It is persisted in KV so operators can customise it without redeploying.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentSoul {
  name: string;
  tone: string;
  avatar: string;
  description: string;
  capabilities: string[];
  personality: string[];
}

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
// Default soul
// ---------------------------------------------------------------------------

export const DEFAULT_SOUL: AgentSoul = {
  name: "Atlas",
  tone: "professional, organized, proactive",
  avatar: "briefcase",
  description:
    "A business operations agent that helps teams stay aligned, track action items, and surface insights from conversations.",
  capabilities: [
    "summarize discussions",
    "extract action items",
    "track decisions",
    "surface business metrics",
    "schedule follow-ups",
    "route questions to the right team member",
  ],
  personality: [
    "Be concise and action-oriented.",
    "Proactively flag blockers and risks.",
    "Respect confidentiality — never share private team data outside its context.",
    "When uncertain, ask for clarification rather than guessing.",
    "Keep track of open items and remind the team proactively.",
  ],
};

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

/**
 * Combines the soul personality with the runtime context to produce a system
 * prompt suitable for the DeepSeek (or compatible) chat API.
 */
export function buildSystemPrompt(soul: AgentSoul, context: AgentContext): string {
  const sections: string[] = [];

  sections.push(`# Agent: ${soul.name}`);
  sections.push(`Tone: ${soul.tone}`);
  sections.push(`Description: ${soul.description}`);
  sections.push("");

  sections.push("## Personality Guidelines");
  for (const trait of soul.personality) {
    sections.push(`- ${trait}`);
  }
  sections.push("");

  sections.push("## Capabilities");
  for (const cap of soul.capabilities) {
    sections.push(`- ${cap}`);
  }
  sections.push("");

  sections.push("## Current Context");
  sections.push(`- Team: ${context.teamName}`);
  sections.push(`- User: ${context.userName} (${context.userRole})`);
  sections.push(`- Channel: ${context.channel}`);
  sections.push(`- Conversation: ${context.conversationId}`);

  if (context.recentTopics.length > 0) {
    sections.push(`- Recent topics: ${context.recentTopics.join(", ")}`);
  }

  if (context.businessMetrics) {
    const metrics = Object.entries(context.businessMetrics)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    sections.push(`- Key metrics: ${metrics}`);
  }

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// KV persistence
// ---------------------------------------------------------------------------

const SOUL_KEY = "agent:soul";

/**
 * Load the agent soul from KV. Falls back to DEFAULT_SOUL when the key is
 * missing or the stored JSON is malformed.
 */
export async function loadSoul(kv: KVNamespace): Promise<AgentSoul> {
  const raw = await kv.get(SOUL_KEY, "text");
  if (!raw) {
    return DEFAULT_SOUL;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AgentSoul>;
    return {
      name: parsed.name ?? DEFAULT_SOUL.name,
      tone: parsed.tone ?? DEFAULT_SOUL.tone,
      avatar: parsed.avatar ?? DEFAULT_SOUL.avatar,
      description: parsed.description ?? DEFAULT_SOUL.description,
      capabilities: parsed.capabilities ?? DEFAULT_SOUL.capabilities,
      personality: parsed.personality ?? DEFAULT_SOUL.personality,
    };
  } catch {
    return DEFAULT_SOUL;
  }
}
