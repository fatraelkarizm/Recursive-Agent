import type { MissionProgressEvent, MissionRequest, MissionResponse } from "@/lib/types";
import { createMission } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

function parseSseChunk(buffer: string): { events: Array<{ type: string; data: string }>; rest: string } {
  const events: Array<{ type: string; data: string }> = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    if (!part.trim()) continue;
    let type = "message";
    const dataLines: string[] = [];
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) type = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) events.push({ type, data: dataLines.join("\n") });
  }
  return { events, rest };
}

export type MissionStreamHandlers = {
  onProgress: (event: MissionProgressEvent) => void;
  onDone: (result: MissionResponse) => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
};

async function streamMission(
  payload: MissionRequest,
  handlers: MissionStreamHandlers
): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/missions/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: handlers.signal
    });
  } catch (err) {
    if (handlers.signal?.aborted) return false;
    const msg = err instanceof Error ? err.message : "network error";
    throw new Error(msg);
  }

  if (!response.ok || !response.body) {
    return false;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let gotDone = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseChunk(buffer);
    buffer = parsed.rest;

    for (const ev of parsed.events) {
      try {
        const json = JSON.parse(ev.data) as unknown;
        if (ev.type === "progress") handlers.onProgress(json as MissionProgressEvent);
        else if (ev.type === "done") {
          gotDone = true;
          handlers.onDone(json as MissionResponse);
        } else if (ev.type === "error") {
          handlers.onError((json as { message: string }).message);
          return true;
        }
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
  return gotDone;
}

/** SSE with automatic fallback to POST /api/missions when stream drops (network error). */
export async function createMissionStream(
  payload: MissionRequest,
  handlers: MissionStreamHandlers
): Promise<void> {
  try {
    const ok = await streamMission(payload, handlers);
    if (ok) return;
  } catch (err) {
    if (handlers.signal?.aborted) return;
    const message = err instanceof Error ? err.message : "network error";
    if (!message.toLowerCase().includes("network") && !message.toLowerCase().includes("fetch")) {
      handlers.onError(`Stream gagal: ${message}`);
      return;
    }
  }

  if (handlers.signal?.aborted) return;

  handlers.onProgress({
    phase: "tools",
    label: "Fallback: menyelesaikan mission (non-stream)",
    at: new Date().toISOString()
  });

  try {
    const result = await createMission(payload);
    handlers.onDone(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mission failed";
    handlers.onError(
      message.toLowerCase().includes("network") || message.toLowerCase().includes("fetch")
        ? "Koneksi ke backend putus. Pastikan `npm run dev` di folder backend (port 4000)."
        : message
    );
  }
}
