import { logger } from "../logging";

const MEM0_API_BASE = "https://api.mem0.ai/v1";

function getApiKey(): string | null {
  return process.env.MEM0_API_KEY?.trim() || null;
}

function headers(): Record<string, string> {
  const key = getApiKey();
  if (!key) throw new Error("MEM0_API_KEY not set");
  return {
    "Content-Type": "application/json",
    Authorization: `Token ${key}`,
  };
}

export type Mem0Memory = {
  id: string;
  memory: string;
  user_id?: string;
  agent_id?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

export type Mem0Status = {
  configured: boolean;
  connected: boolean;
  memoryCount: number;
};

export async function getMem0Status(): Promise<Mem0Status> {
  const key = getApiKey();
  if (!key) return { configured: false, connected: false, memoryCount: 0 };

  try {
    const res = await fetch(`${MEM0_API_BASE}/memories/`, {
      method: "GET",
      headers: headers(),
    });
    if (!res.ok) return { configured: true, connected: false, memoryCount: 0 };
    const data = (await res.json()) as { results?: unknown[] };
    return {
      configured: true,
      connected: true,
      memoryCount: Array.isArray(data.results) ? data.results.length : 0,
    };
  } catch (err) {
    logger.warn({ err }, "mem0 status check failed");
    return { configured: true, connected: false, memoryCount: 0 };
  }
}

export async function addMemory(
  content: string,
  opts: { userId?: string; agentId?: string; metadata?: Record<string, unknown> } = {}
): Promise<Mem0Memory | null> {
  const key = getApiKey();
  if (!key) return null;

  try {
    const body: Record<string, unknown> = {
      messages: [{ role: "user", content }],
    };
    if (opts.userId) body.user_id = opts.userId;
    if (opts.agentId) body.agent_id = opts.agentId;
    if (opts.metadata) body.metadata = opts.metadata;

    const res = await fetch(`${MEM0_API_BASE}/memories/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "mem0 add memory failed");
      return null;
    }

    const data = (await res.json()) as { results?: Mem0Memory[] };
    const first = data.results?.[0] ?? null;
    if (first) logger.info({ id: first.id }, "mem0 memory added");
    return first;
  } catch (err) {
    logger.warn({ err }, "mem0 add memory error");
    return null;
  }
}

export async function searchMemories(
  query: string,
  opts: { userId?: string; agentId?: string; topK?: number } = {}
): Promise<Mem0Memory[]> {
  const key = getApiKey();
  if (!key) return [];

  try {
    const body: Record<string, unknown> = {
      query,
      top_k: opts.topK ?? 10,
    };
    if (opts.userId) body.user_id = opts.userId;
    if (opts.agentId) body.agent_id = opts.agentId;

    const res = await fetch(`${MEM0_API_BASE}/memories/search/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "mem0 search failed");
      return [];
    }

    const data = (await res.json()) as { results?: Mem0Memory[] };
    return data.results ?? [];
  } catch (err) {
    logger.warn({ err }, "mem0 search error");
    return [];
  }
}

export async function getAllMemories(
  opts: { userId?: string; agentId?: string } = {}
): Promise<Mem0Memory[]> {
  const key = getApiKey();
  if (!key) return [];

  try {
    const params = new URLSearchParams();
    if (opts.userId) params.set("user_id", opts.userId);
    if (opts.agentId) params.set("agent_id", opts.agentId);

    const url = `${MEM0_API_BASE}/memories/?${params.toString()}`;
    const res = await fetch(url, { method: "GET", headers: headers() });

    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Mem0Memory[] };
    return data.results ?? [];
  } catch (err) {
    logger.warn({ err }, "mem0 get all memories error");
    return [];
  }
}
