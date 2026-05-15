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
import {
  ensureLeadHtmlDeliverable,
  ensureSquadHtmlDeliverables,
  missionWantsHtmlDeliverable,
  readmeHasHtmlFence
} from "./mother-deliverable";
import { runMotherQualityReview } from "./mother-review";
import { runMotherWebResearch } from "./mother-research";
import { attachSpecialistArtifacts } from "./specialist-artifacts";
import { ensureLeadFleetReady, isAutoOrchestrationEnabled } from "./specializations";
import { updateCanvasAgentProfile } from "../db/agent-store";
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
    phase: "tools",
    label: "Mother riset web (Tavily)",
    detail: "Mencari referensi & tren sebelum merancang squad"
  });
  const webResearch = await runMotherWebResearch(effectivePrompt);

  const synthPayload: MissionPayload = {
    ...payload,
    preferTavilySearch: true,
    contextNotes: [
      payload.contextNotes?.trim(),
      "## Riset web (Tavily — otomatis sebelum spawn)",
      webResearch
    ]
      .filter(Boolean)
      .join("\n\n")
  };

  emit({
    phase: "mother-planning",
    label: "Mother berpikir…",
    detail: "Mendekomposisi misi dan merancang squad specialist"
  });

  const synthPrompt = buildEffectiveMissionPrompt(synthPayload);
  const { squad, motherBrief, source, parseError } = await synthesizeSquadFromMother(synthPayload);

  for (const member of squad) {
    attachSpecialistArtifacts(member, synthPrompt);
  }

  const fleetLead = squad.find((s) => s.canvasLane === "frontend") ?? squad[0];
  ensureLeadFleetReady(fleetLead, synthPrompt);
  for (const member of squad) {
    if (member !== fleetLead && isAutoOrchestrationEnabled()) {
      member.orchestrationMode = "openclaw";
      if (!member.specializations.includes("openclaw-orchestration")) {
        member.specializations = [...member.specializations, "openclaw-orchestration"];
      }
    }
  }

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
  if (missionWantsHtmlDeliverable(synthPrompt)) {
    emit({
      phase: "specialist-readme",
      label: "Mother menulis deliverable HTML",
      detail: squad.map((s) => s.canvasLane ?? "general").join(" + ")
    });
    const added = await ensureSquadHtmlDeliverables(squad, synthPrompt, { webResearch });
    if (added > 0) {
      htmlDeliverableNote = `Mother: HTML deliverable untuk ${added} specialist (frontend README).`;
    } else {
      htmlDeliverableNote =
        source === "fallback-rules" && parseError
          ? `Mother: rencana LLM gagal (${parseError.slice(0, 120)}). HTML belum terbuat — coba lagi tanpa refresh saat mission jalan.`
          : "Mother: HTML deliverable belum terbuat — cek gateway qwen3.6-plus di SumoPod.";
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

  const profile = fleetLead;
  const graph = buildMissionGraph(profile);
  const events: string[] = [];
  events.push(`Mother research:\n${webResearch.slice(0, 1200)}${webResearch.length > 1200 ? "…" : ""}`);
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
  if (isAutoOrchestrationEnabled() && profile.subAgents?.length) {
    emit({
      phase: "fleet-run",
      label: "OpenClaw fleet otomatis",
      detail: `${profile.subAgents.length} sub-agent via OpenClaw (utama) + gateway fallback`
    });
    const fleet = await runSubAgentFleet({
      missionId,
      motherPrompt: synthPrompt,
      profile,
      browserContext: webResearch,
      onProgress: (subLabel) => {
        emit({ phase: "fleet-run", label: subLabel });
      }
    });
    events.push(...fleet.events);
    fleetSummary = fleet.summary;

    for (const run of fleet.summary.subAgentRuns) {
      if (run.source === "openclaw" && run.output.length > 80) {
        const fe = squad.find((s) => s.canvasLane === "frontend");
        if (fe && run.role.includes("worker") && !readmeHasHtmlFence(fe.readmeMd)) {
          fe.readmeMd += [
            "",
            "---",
            "",
            "## Output fleet (OpenClaw worker)",
            "",
            run.output.slice(0, 8000),
            ""
          ].join("\n");
        }
      }
    }

    emit({ phase: "fleet-merge", label: "Mother menggabungkan laporan fleet" });
  } else if (shouldRunOpenClaw(profile)) {
    const oc = await orchestrateViaOpenClaw({
      missionId,
      motherPrompt: synthPrompt,
      profile
    });
    events.push(oc);
  }

  emit({ phase: "tools", label: "Tool route & sandbox" });
  const toolEvent = await runToolRoute(effectivePrompt, { preferTavilySearch: payload.preferTavilySearch === true });
  events.push(`Tool route: ${toolEvent}`);

  const sandboxEvent = await runSandboxTask("echo specialist-agent-ready");
  events.push(`Sandbox: ${sandboxEvent}`);

  emit({
    phase: "mother-review",
    label: "Mother review hasil agent",
    detail: "Memeriksa setiap specialist vs misi user"
  });
  const quality = await runMotherQualityReview({
    missionPrompt: effectivePrompt,
    squad,
    fleetSummary
  });
  const motherReview = quality.reviewMarkdown;
  events.push(`Mother review: ${motherReview.slice(0, 240)}${motherReview.length > 240 ? "…" : ""}`);

  const reworkTargets = quality.verdicts.filter((v) => v.verdict === "rework");
  if (reworkTargets.length > 0) {
    emit({
      phase: "mother-review",
      label: "Mother menyuruh rework",
      detail: reworkTargets.map((r) => r.agentName).join(", ")
    });
    for (const v of reworkTargets) {
      const agent = squad.find((s) => s.name === v.agentName) ?? lead;
      const ok = await ensureLeadHtmlDeliverable(agent, synthPrompt, {
        revisionNotes: v.instructions ?? "Perbaiki deliverable agar sesuai misi user.",
        force: true,
        webResearch
      });
      if (ok) events.push(`Mother: rework selesai untuk ${agent.name}`);
    }
  }

  let finalSquad = squad;
  const result: MissionResult = {
    missionId,
    status: "completed",
    profile,
    specialists: squad.length > 1 ? squad : undefined,
    fleetSummary,
    motherBrief,
    motherReview,
    squadSource: source,
    events
  };

  emit({ phase: "persist", label: "Menyimpan ke database" });
  try {
    const persistence = await persistMissionResult({
      prompt: effectivePrompt,
      result: { ...result, profile: finalSquad[0], specialists: finalSquad.length > 1 ? finalSquad : undefined }
    });

    if (persistence.squadWithIds?.length) {
      finalSquad = persistence.squadWithIds;
      result.profile = finalSquad[0];
      result.specialists = finalSquad.length > 1 ? finalSquad : undefined;
      for (const agent of finalSquad) {
        if (agent.persistedId) {
          await updateCanvasAgentProfile(agent.persistedId, agent);
        }
      }
      events.push(`Canvas: ${finalSquad.length} agent tersimpan (id persisten).`);
    }

    result.events.push(
      persistence.persisted
        ? "Persistence: mission saved to PostgreSQL"
        : `Persistence skipped: ${persistence.reason}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown database error";
    result.events.push(`Persistence failed: ${message}`);
  }

  result.profile = finalSquad[0];
  result.specialists = finalSquad.length > 1 ? finalSquad : undefined;

  emit({ phase: "done", label: "Mission selesai", detail: missionId });
  return result;
}
