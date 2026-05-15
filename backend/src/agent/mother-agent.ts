import type { MissionPayload, MissionResult, SpecialistAgentProfile } from "../types";
import { buildMissionGraph } from "./mission-graph";
import { orchestrateViaOpenClaw, shouldRunOpenClaw } from "./openclaw-bridge";
import { runSubAgentFleet } from "./fleet-orchestrator";
import { inferSpecialistSquad } from "./squad-inference";
import { runToolRoute } from "./tool-router";
import { runSandboxTask } from "../sandbox/e2b";
import { browserTouchFromPrompt } from "../capabilities/browser";
import { enrichProfileReadmeWithSumopod } from "../compat/openai-compatible-chat";
import { persistMissionResult } from "../db/mission-store";

function randomId(length = 8): string {
  return Math.random().toString(36).slice(2, 2 + length);
}

/** @deprecated Prefer `inferSpecialistSquad` — kept for clarity; returns lead specialist only. */
export function generateSpecialistProfile(prompt: string): SpecialistAgentProfile {
  return inferSpecialistSquad(prompt)[0];
}

export async function runMission(payload: MissionPayload): Promise<MissionResult> {
  const missionId = randomId(10);
  const squad = inferSpecialistSquad(payload.prompt);
  for (const member of squad) {
    await enrichProfileReadmeWithSumopod(member, payload.prompt);
  }

  const profile = squad[0];
  const graph = buildMissionGraph(profile);
  const events: string[] = [];
  if (squad.length > 1) {
    events.push(
      `Squad: ${squad.length} specialists (${squad.map((s) => `${s.name}:${s.canvasLane ?? "general"}`).join(", ")})`
    );
  }
  events.push(`Mission graph steps: ${graph.steps.join(" -> ")}`);

  let browserContext: string | undefined;
  if (profile.specializations.includes("browser-automation")) {
    const browserEvent = await browserTouchFromPrompt(payload.prompt);
    events.push(browserEvent);
    browserContext = browserEvent;
  }

  let fleetSummary: MissionResult["fleetSummary"];
  if (profile.subAgents?.length) {
    const fleet = await runSubAgentFleet({
      missionId,
      motherPrompt: payload.prompt,
      profile,
      browserContext
    });
    events.push(...fleet.events);
    fleetSummary = fleet.summary;
  } else if (shouldRunOpenClaw(profile)) {
    const oc = await orchestrateViaOpenClaw({
      missionId,
      motherPrompt: payload.prompt,
      profile
    });
    events.push(oc);
  }

  const toolEvent = await runToolRoute(payload.prompt);
  events.push(`Tool route: ${toolEvent}`);

  const sandboxEvent = await runSandboxTask("echo specialist-agent-ready");
  events.push(`Sandbox: ${sandboxEvent}`);

  const result: MissionResult = {
    missionId,
    status: "completed",
    profile,
    specialists: squad.length > 1 ? squad : undefined,
    fleetSummary,
    events
  };

  try {
    const persistence = await persistMissionResult({
      prompt: payload.prompt,
      result
    });

    result.events.push(
      persistence.persisted
        ? "Persistence: mission saved to PostgreSQL"
        : `Persistence skipped: ${persistence.reason}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown database error";
    result.events.push(`Persistence failed: ${message}`);
  }

  return result;
}
