import type { MissionProgressEvent, MissionRequest, MissionResponse } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

function parseSseChunk(buffer: string): { events: Array<{ type: string; data: string }>; rest: string } {
  const events: Array<{ type: string; data: string }> = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
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

export async function createMissionStream(
  payload: MissionRequest,
  handlers: {
    onProgress: (event: MissionProgressEvent) => void;
    onDone: (result: MissionResponse) => void;
    onError: (message: string) => void;
  }
): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/missions/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok || !response.body) {
    handlers.onError("Stream mission gagal — pastikan backend jalan di port 4000.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
        else if (ev.type === "done") handlers.onDone(json as MissionResponse);
        else if (ev.type === "error") handlers.onError((json as { message: string }).message);
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
}
