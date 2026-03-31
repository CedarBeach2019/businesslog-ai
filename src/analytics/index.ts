export interface DashboardData {
  messagesPerDay: Array<{ date: string; count: number }>;
  activeUsers: Array<{ date: string; count: number }>;
  topTopics: Array<{ topic: string; count: number }>;
  totalMessages: number;
  totalUsers: number;
  avgResponseTime: number;
  channelBreakdown: Record<string, number>;
}

export interface ReportOptions {
  type: 'daily' | 'weekly' | 'monthly';
  format: 'json' | 'csv';
  startDate?: string;
  endDate?: string;
}

function dateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateStr(d);
}

async function recordEvent(
  kv: KVNamespace,
  event: string,
  userId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const today = dateStr(new Date());

  // Increment daily event counter
  const eventKey = `analytics:events:${today}`;
  const eventCount = parseInt((await kv.get(eventKey)) ?? '0', 10);
  await kv.put(eventKey, String(eventCount + 1));

  // Record active user
  const userKey = `analytics:users:${today}:${userId}`;
  await kv.put(userKey, '1', { expirationTtl: 90 * 24 * 60 * 60 });

  // Record topic if present in metadata
  if (metadata?.topic) {
    const topic = String(metadata.topic);
    const topicKey = `analytics:topics:${topic}`;
    const topicCount = parseInt((await kv.get(topicKey)) ?? '0', 10);
    await kv.put(topicKey, String(topicCount + 1));
  }

  // Record channel breakdown
  if (metadata?.channel) {
    const channel = String(metadata.channel);
    const channelKey = `analytics:channels:${today}:${channel}`;
    const channelCount = parseInt((await kv.get(channelKey)) ?? '0', 10);
    await kv.put(channelKey, String(channelCount + 1));
  }
}

async function getDashboard(kv: KVNamespace, days: number = 30): Promise<DashboardData> {
  const messagesPerDay = await getMessagesPerDay(kv, days);
  const activeUsers = await getActiveUsers(kv, days);
  const topTopics = await getTopTopics(kv, 10);

  const totalMessages = messagesPerDay.reduce((sum, d) => sum + d.count, 0);
  const totalUsers = activeUsers.reduce((sum, d) => sum + d.count, 0);

  // Channel breakdown
  const channelBreakdown: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const day = daysAgo(i);
    const list = await kv.list({ prefix: `analytics:channels:${day}:` });
    for (const key of list.keys) {
      const channel = key.name.split(':').pop() ?? 'unknown';
      const count = parseInt((await kv.get(key.name)) ?? '0', 10);
      channelBreakdown[channel] = (channelBreakdown[channel] ?? 0) + count;
    }
  }

  return {
    messagesPerDay,
    activeUsers,
    topTopics,
    totalMessages,
    totalUsers,
    avgResponseTime: 0,
    channelBreakdown,
  };
}

async function generateReport(kv: KVNamespace, options: ReportOptions): Promise<string> {
  const dayMap: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };
  const days = dayMap[options.type] ?? 30;

  const startDate = options.startDate ?? daysAgo(days - 1);
  const endDate = options.endDate ?? dateStr(new Date());

  const messagesPerDay = await getMessagesPerDay(kv, days);
  const activeUsers = await getActiveUsers(kv, days);
  const topTopics = await getTopTopics(kv, 20);

  const report = {
    type: options.type,
    startDate,
    endDate,
    messagesPerDay,
    activeUsers,
    topTopics,
    totalMessages: messagesPerDay.reduce((s, d) => s + d.count, 0),
  };

  if (options.format === 'csv') {
    return toCSV(messagesPerDay);
  }

  return JSON.stringify(report, null, 2);
}

async function getTopTopics(
  kv: KVNamespace,
  limit: number = 10
): Promise<Array<{ topic: string; count: number }>> {
  const list = await kv.list({ prefix: 'analytics:topics:' });
  const topics: Array<{ topic: string; count: number }> = [];

  for (const key of list.keys) {
    const topic = key.name.replace('analytics:topics:', '');
    const count = parseInt((await kv.get(key.name)) ?? '0', 10);
    topics.push({ topic, count });
  }

  return topics.sort((a, b) => b.count - a.count).slice(0, limit);
}

async function getMessagesPerDay(
  kv: KVNamespace,
  days: number
): Promise<Array<{ date: string; count: number }>> {
  const result: Array<{ date: string; count: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = daysAgo(i);
    const key = `analytics:events:${day}`;
    const count = parseInt((await kv.get(key)) ?? '0', 10);
    result.push({ date: day, count });
  }

  return result;
}

async function getActiveUsers(
  kv: KVNamespace,
  days: number
): Promise<Array<{ date: string; count: number }>> {
  const result: Array<{ date: string; count: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = daysAgo(i);
    const prefix = `analytics:users:${day}:`;
    const list = await kv.list({ prefix });
    result.push({ date: day, count: list.keys.length });
  }

  return result;
}

function toCSV(data: Array<Record<string, unknown>>): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = String(row[h] ?? '');
      return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export {
  recordEvent,
  getDashboard,
  generateReport,
  getTopTopics,
  getMessagesPerDay,
  getActiveUsers,
  toCSV,
};
