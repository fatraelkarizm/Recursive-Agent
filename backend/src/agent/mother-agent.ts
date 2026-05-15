import type { MissionPayload, MissionResult, SpecialistAgentProfile } from "../types";
import { buildEffectiveMissionPrompt } from "./mission-prompt";
import { buildMissionGraph } from "./mission-graph";
import { orchestrateViaOpenClaw, shouldRunOpenClaw } from "./openclaw-bridge";
import { runSubAgentFleet } from "./fleet-orchestrator";
import { synthesizeSquadFromMother } from "./mother-synthesize";
import { runToolRoute } from "./tool-router";
import { runSandboxTask } from "../sandbox/e2b";
import { browserTouchFromPrompt } from "../capabilities/browser";
import { enrichProfileReadmeWithSumopod } from "../compat/openai-compatible-chat";
import { ensureLeadHtmlDeliverable, missionWantsHtmlDeliverable } from "./mother-deliverable";
import { persistMissionResult } from "../db/mission-store";
import type { MissionProgressEmitter } from "./mission-progress";
import { createProgressEmitter } from "./mission-progress";

function randomId(length = 8): string {
  return Math.random().toString(36).slice(2, 2 + length);
}

export async function runMission(
  payload: MissionPayload,
  onProgress?: MissionProgressEmitter
): Promise<MissionResult> {
  const emit = createProgressEmitter(onProgress);
  const missionId = randomId(10);
  const effectivePrompt = buildEffectiveMissionPrompt(payload);

  emit({
    phase: "mother-planning",
    label: "Mother berpikir…",
    detail: "Mendekomposisi misi dan merancang squad specialist"
  });

  const { squad, motherBrief, source, parseError } = await synthesizeSquadFromMother(payload);

  emit({
    phase: "mother-spawn",
    label: "Mother menghasilkan agent",
    detail: squad.map((s) => s.name).join(", ")
  });

  emit({
    phase: "mother-review",
    label: "Review rencana",
    detail: motherBrief.slice(0, 280)
  });

  const lead = squad[0];
  let htmlDeliverableNote: string | null = null;
  if (missionWantsHtmlDeliverable(effectivePrompt)) {
    emit({
      phase: "specialist-readme",
      label: "Mother menulis deliverable HTML",
      detail: lead.name
    });
    const added = await ensureLeadHtmlDeliverable(lead, effectivePrompt);
    if (added) {
      htmlDeliverableNote = "Mother: HTML deliverable generated for lead specialist README.";
    } else if (source === "fallback-rules") {
      htmlDeliverableNote =
        "Mother: HTML deliverable gagal — cek gateway/model. Parse error: " + (parseError ?? "n/a");
    }
  }

  for (const member of squad) {
    if (source === "fallback-rules" && member.readmeMd.length < 400 && !missionWantsHtmlDeliverable(effectivePrompt)) {
      emit({
        phase: "specialist-readme",
        label: `Melengkapi README · ${member.name}`,
        detail: member.role
      });
      await enrichProfileReadmeWithSumopod(member, effectivePrompt);
    }
  }

  const profile = squad[0];
  const graph = buildMissionGraph(profile);
  const events: string[] = [];
  if (htmlDeliverableNote) events.push(htmlDeliverableNote);
  if (parseError && source === "fallback-rules") {
    events.push(`Mother: JSON parse error — ${parseError}`);
  }
  events.push(`Mother: squad via ${source}`);
  events.push(`Mother brief: ${motherBrief.slice(0, 500)}${motherBrief.length > 500 ? "…" : ""}`);

  if (squad.length > 1) {
    events.push(
      `Squad: ${squad.length} specialists (${squad.map((s) => `${s.name}:${s.canvasLane ?? "general"}`).join(", ")})`
    );
  }
  events.push(`Mission graph steps: ${graph.steps.join(" -> ")}`);

  let browserContext: string | undefined;
  if (profile.specializations.includes("browser-automation")) {
    const browserEvent = await browserTouchFromPrompt(effectivePrompt);
    events.push(browserEvent);
    browserContext = browserEvent;
  }

  let fleetSummary: MissionResult["fleetSummary"];
  if (profile.subAgents?.length) {
    emit({
      phase: "fleet-run",
      label: "Fleet sub-agent berjalan",
      detail: `${profile.subAgents.length} leg sequential`
    });
    const fleet = await runSubAgentFleet({
      missionId,
      motherPrompt: effectivePrompt,
      profile,
      browserContext,
      onProgress: (subLabel) => {
        emit({ phase: "fleet-run", label: subLabel });
      }
    });
    events.push(...fleet.events);
    fleetSummary = fleet.summary;
    emit({ phase: "fleet-merge", label: "Mother menggabungkan laporan fleet" });
  } else if (shouldRunOpenClaw(profile)) {
    const oc = await orchestrateViaOpenClaw({
      missionId,
      motherPrompt: effectivePrompt,
      profile
    });
    events.push(oc);
  }

  emit({ phase: "tools", label: "Tool route & sandbox" });
  const toolEvent = await runToolRoute(effectivePrompt, { preferTavilySearch: payload.preferTavilySearch === true });
  events.push(`Tool route: ${toolEvent}`);

  const sandboxEvent = await runSandboxTask("echo specialist-agent-ready");
  events.push(`Sandbox: ${sandboxEvent}`);

  const result: MissionResult = {
    missionId,
    status: "completed",
    profile,
    specialists: squad.length > 1 ? squad : undefined,
    fleetSummary,
    motherBrief,
    squadSource: source,
    events
  };

  emit({ phase: "persist", label: "Menyimpan ke database" });
  try {
    const persistence = await persistMissionResult({
      prompt: effectivePrompt,
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

  emit({ phase: "done", label: "Mission selesai", detail: missionId });
  return result;
}
