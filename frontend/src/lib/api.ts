import type { MissionRequest, MissionResponse, PublicRuntimeDiagnostics } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export async function fetchRuntimeDiagnostics(): Promise<PublicRuntimeDiagnostics> {
  const response = await fetch(`${BACKEND_URL}/api/runtime-config`, { method: "GET" });
  if (!response.ok) {
    throw new Error("Failed to load runtime config");
  }
  return response.json() as Promise<PublicRuntimeDiagnostics>;
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
