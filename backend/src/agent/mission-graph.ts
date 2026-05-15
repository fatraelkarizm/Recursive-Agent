import type { SpecialistAgentProfile } from "../types";

export function buildMissionGraph(profile: SpecialistAgentProfile): { steps: string[] } {
  const steps: string[] = [
    `Create specialist profile (${profile.role})`,
    "Validate specialist config",
    "Plan tool + sandbox actions"
  ];

  if (profile.specializations.includes("web-stack-split")) {
    steps.splice(1, 0, "Infer frontend + backend specialist squad");
  }

  if (profile.specializations.includes("browser-automation")) {
    steps.push("Read target URL via Tavily Extract (no local browser)");
  }

  if (profile.orchestrationMode === "openclaw" || profile.specializations.includes("openclaw-orchestration")) {
    steps.push(
      profile.subAgents?.length
        ? "Run sub-agent fleet sequentially (LLM gateway or OpenClaw per sub) + merge report to mother"
        : "Delegate fleet coordination to OpenClaw CLI"
    );
  }

  steps.push("Execute tool route", "Run sandbox checkpoint", "Return mission summary");

  return { steps };
}
