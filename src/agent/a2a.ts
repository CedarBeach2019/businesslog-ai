/**
 * a2a.ts — Agent-to-Agent protocol for business system integration.
 *
 * Defines the wire format, capability registry, message routing, and event
 * broadcasting. Fully self-contained — no external dependencies beyond the
 * Workers runtime KVNamespace type.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface A2AMessage {
  from: string;
  to: string;
  type: "query" | "command" | "event" | "sync";
  payload: Record<string, unknown>;
  timestamp: string;
  traceId: string;
}

export interface A2ACapability {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Default capabilities
// ---------------------------------------------------------------------------

export const DEFAULT_CAPABILITIES: A2ACapability[] = [
  {
    name: "search",
    description: "Search business data and conversations",
    inputSchema: { type: "object", properties: { query: { type: "string" } } },
    outputSchema: { type: "object", properties: { results: { type: "array" } } },
  },
  {
    name: "report",
    description: "Generate a business summary report",
    inputSchema: {
      type: "object",
      properties: {
        metric: { type: "string" },
        range: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: { report: { type: "object" } },
    },
  },
  {
    name: "notify",
    description: "Send a notification to team members",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        message: { type: "string" },
      },
    },
    outputSchema: { type: "object", properties: { delivered: { type: "boolean" } } },
  },
  {
    name: "schedule",
    description: "Schedule a follow-up or reminder",
    inputSchema: {
      type: "object",
      properties: {
        at: { type: "string", format: "date-time" },
        message: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: { scheduledAt: { type: "string" } },
    },
  },
];

// ---------------------------------------------------------------------------
// Message construction & validation
// ---------------------------------------------------------------------------

const VALID_TYPES = new Set(["query", "command", "event", "sync"]);

export function createA2AMessage(
  from: string,
  to: string,
  type: A2AMessage["type"],
  payload: Record<string, unknown>,
): A2AMessage {
  return {
    from,
    to,
    type,
    payload,
    timestamp: new Date().toISOString(),
    traceId: crypto.randomUUID(),
  };
}

/** Validate and parse a raw value into an A2AMessage. Returns null on failure. */
export function parseA2AMessage(raw: unknown): A2AMessage | null {
  if (typeof raw !== "object" || raw === null) return null;

  const msg = raw as Record<string, unknown>;

  if (
    typeof msg.from !== "string" ||
    typeof msg.to !== "string" ||
    typeof msg.type !== "string" ||
    !VALID_TYPES.has(msg.type) ||
    typeof msg.payload !== "object" ||
    msg.payload === null ||
    typeof msg.timestamp !== "string" ||
    typeof msg.traceId !== "string"
  ) {
    return null;
  }

  return {
    from: msg.from,
    to: msg.to,
    type: msg.type as A2AMessage["type"],
    payload: msg.payload as Record<string, unknown>,
    timestamp: msg.timestamp,
    traceId: msg.traceId,
  };
}

// ---------------------------------------------------------------------------
// Capability registration
// ---------------------------------------------------------------------------

export function registerCapability(
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
): A2ACapability {
  return { name, description, inputSchema, outputSchema };
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

const A2A_QUEUE_PREFIX = "a2a:queue:";
const A2A_CAPABILITIES_KEY = "a2a:capabilities";

async function handleCapability(
  message: A2AMessage,
  kv: KVNamespace,
): Promise<A2AMessage> {
  const capability = message.payload["capability"] as string | undefined;

  switch (capability) {
    case "search": {
      const query = (message.payload["query"] as string) ?? "";
      return createA2AMessage(message.to, message.from, "query", {
        results: [],
        query,
        status: "completed",
      });
    }
    case "report": {
      return createA2AMessage(message.to, message.from, "query", {
        report: { generated: true, timestamp: new Date().toISOString() },
        status: "completed",
      });
    }
    case "notify": {
      const channel = (message.payload["channel"] as string) ?? "general";
      return createA2AMessage(message.to, message.from, "command", {
        delivered: true,
        channel,
      });
    }
    case "schedule": {
      return createA2AMessage(message.to, message.from, "command", {
        scheduledAt: message.payload["at"] ?? new Date().toISOString(),
        status: "scheduled",
      });
    }
    default:
      return createA2AMessage(message.to, message.from, "query", {
        error: `Unknown capability: ${capability ?? "undefined"}`,
        status: "error",
      });
  }
}

/** Route an incoming A2A message to the appropriate handler. */
export async function handleA2ARequest(
  message: A2AMessage,
  kv: KVNamespace,
): Promise<A2AMessage> {
  // Persist capability list on first interaction.
  const existing = await kv.get(A2A_CAPABILITIES_KEY);
  if (!existing) {
    await kv.put(
      A2A_CAPABILITIES_KEY,
      JSON.stringify(DEFAULT_CAPABILITIES),
    );
  }

  return handleCapability(message, kv);
}

// ---------------------------------------------------------------------------
// Event broadcast
// ---------------------------------------------------------------------------

/** Broadcast an event to all subscribers by appending to the shared queue. */
export async function broadcastEvent(
  event: string,
  data: Record<string, unknown>,
  kv: KVNamespace,
): Promise<void> {
  const message = createA2AMessage("system", "broadcast", "event", {
    event,
    data,
  });

  const queueRaw = await kv.get(A2A_QUEUE_PREFIX + "events", "text");
  const queue: A2AMessage[] = queueRaw ? (JSON.parse(queueRaw) as A2AMessage[]) : [];
  queue.push(message);

  // Keep only the last 100 events.
  if (queue.length > 100) {
    queue.splice(0, queue.length - 100);
  }

  await kv.put(A2A_QUEUE_PREFIX + "events", JSON.stringify(queue));
}
