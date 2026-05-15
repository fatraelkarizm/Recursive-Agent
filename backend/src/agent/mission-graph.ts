import type { SpecialistAgentProfile } from "../types";

export function buildMissionGraph(profile: SpecialistAgentProfile): { steps: string[] } {
  return {
    steps: [
      `Create specialist profile (${profile.role})`,
      "Validate specialist config",
      "Execute one tool action",
      "Return mission summary"
    ]
  };
}
