import type { SpecialistAgentProfile } from "@/lib/types";

export function isPlaceholderAgent(p: SpecialistAgentProfile): boolean {
  return p.role === "pending" && p.name === "Pending Agent";
}

/** Append new specialists without removing existing canvas agents. */
export function mergeCanvasAgents(
  existing: SpecialistAgentProfile[],
  incoming: SpecialistAgentProfile[]
): SpecialistAgentProfile[] {
  const base = existing.filter((a) => !isPlaceholderAgent(a));
  const next = [...base];

  for (const agent of incoming) {
    if (isPlaceholderAgent(agent)) continue;
    const id = agent.persistedId;
    if (id && next.some((a) => a.persistedId === id)) {
      const idx = next.findIndex((a) => a.persistedId === id);
      next[idx] = agent;
      continue;
    }
    if (!id && next.some((a) => a.name === agent.name && a.missionId === agent.missionId)) {
      continue;
    }
    next.push(agent);
  }

  return next.length > 0 ? next : incoming.filter((a) => !isPlaceholderAgent(a));
}
