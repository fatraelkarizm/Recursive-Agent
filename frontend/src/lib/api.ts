import type {
  MissionRequest,
  MissionResponse,
  PublicRuntimeDiagnostics,
  StoredCanvasAgent
} from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export async function fetchRuntimeDiagnostics(): Promise<PublicRuntimeDiagnostics> {
  const response = await fetch(`${BACKEND_URL}/api/runtime-config`, { method: "GET" });
  if (!response.ok) {
    throw new Error("Failed to load runtime config");
  }
  return response.json() as Promise<PublicRuntimeDiagnostics>;
}

export async function previewExtract(payload: { url: string; query?: string }): Promise<{
  ok: boolean;
  url?: string;
  title?: string | null;
  markdown?: string;
  credits?: number;
  error?: string;
}> {
  const response = await fetch(`${BACKEND_URL}/api/preview-extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = (await response.json()) as {
    ok: boolean;
    url?: string;
    title?: string | null;
    markdown?: string;
    credits?: number;
    error?: string;
  };
  return data;
}

export async function deleteCanvasAgent(agentId: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/agents/${encodeURIComponent(agentId)}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error("Failed to delete agent");
}

export async function clearCanvasAgents(keepMissionId?: string): Promise<number> {
  const q = keepMissionId ? `?keepMission=${encodeURIComponent(keepMissionId)}` : "";
  const response = await fetch(`${BACKEND_URL}/api/agents${q}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to clear agents");
  const data = (await response.json()) as { deleted?: number };
  return data.deleted ?? 0;
}

export async function saveCanvasAgentPosition(
  agentId: string,
  position: { x: number; y: number }
): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/agents/${encodeURIComponent(agentId)}/position`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(position)
  });
  if (!response.ok) {
    throw new Error("Failed to save canvas position");
  }
}

export async function fetchCanvasAgents(): Promise<StoredCanvasAgent[]> {
  const response = await fetch(`${BACKEND_URL}/api/agents`, { method: "GET" });
  if (!response.ok) {
    throw new Error("Failed to load agents");
  }
  const data = (await response.json()) as { agents: StoredCanvasAgent[] };
  const agents = data.agents ?? [];
  return agents.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export type TelegramBotStatus = {
  running: boolean;
  botUsername: string | null;
  token: string | null;
};

export async function fetchTelegramStatus(): Promise<TelegramBotStatus> {
  const response = await fetch(`${BACKEND_URL}/api/telegram/status`, { method: "GET" });
  if (!response.ok) throw new Error("Failed to fetch Telegram status");
  return response.json() as Promise<TelegramBotStatus>;
}

export async function startTelegramBot(token: string): Promise<{ ok: boolean; username?: string; error?: string }> {
  const response = await fetch(`${BACKEND_URL}/api/telegram/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return response.json() as Promise<{ ok: boolean; username?: string; error?: string }>;
}

export async function stopTelegramBot(): Promise<void> {
  await fetch(`${BACKEND_URL}/api/telegram/stop`, { method: "POST" });
}

export async function createMission(payload: MissionRequest): Promise<MissionResponse> {
  const response = await fetch(`${BACKEND_URL}/api/missions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Failed to create mission");
  }

  return response.json() as Promise<MissionResponse>;
}
