import type { MissionRequest, MissionResponse } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

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
