import type { MissionPayload, MissionResult, SpecialistAgentProfile } from "../types";
import { buildEffectiveMissionPrompt } from "./mission-prompt";
import { buildMissionGraph } from "./mission-graph";
import { orchestrateViaOpenClaw, shouldRunOpenClaw } from "./openclaw-bridge";
import { runSubAgentFleet } from "./fleet-orchestrator";
import { synthesizeSquadFromMother } from "./mother-synthesize";
import { runToolRoute } from "./tool-router";
import { browserTouchFromPrompt } from "../capabilities/browser";
import { enrichProfileReadmeWithSumopod } from "../compat/openai-compatible-chat";
import {
  ensureLeadHtmlDeliverable,
  ensureSquadHtmlDeliverables,
  missionWantsHtmlDeliverable,
  readmeHasFallbackHtml,
  readmeHasHtmlFence
} from "./mother-deliverable";
import { runMotherQualityReview } from "./mother-review";
import { runMotherWebResearch } from "./mother-research";
import {
  discoverSkillsForMission,
  enrichSubAgentsWithDiscoveredSkills,
  enrichSquadWithDiscoveredSkills
} from "./skill-discovery";
import { attachSpecialistArtifacts, buildCentralAgentReadme, buildCentralAgentSkillMd, refreshPlainArtifacts } from "./specialist-artifacts";
import { buildOpenClawMissionContext } from "./mother-openclaw-context";
import { ensureLeadFleetReady, isAutoOrchestrationEnabled } from "./specializations";
import { updateCanvasAgentProfile } from "../db/agent-store";
import { persistMissionResult } from "../db/mission-store";
import { addMemory, searchMemories } from "../memory/mem0";
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
    label: "Central Agent recall memory (Mem0)",
    detail: "Mencari memori relevan dari misi sebelumnya"
  });
  let mem0Context = "";
  let mem0RecallCount = 0;
  try {
    const memories = await searchMemories(effectivePrompt, { agentId: "central-agent", topK: 5 });
    if (memories.length > 0) {
      mem0Context = memories.map((m) => m.memory).join("\n");
      mem0RecallCount = memories.length;
    }
  } catch { /* mem0 optional */ }

  emit({
    phase: "tools",
    label: "Central Agent riset web (Tavily)",
    detail: "Mencari referensi & tren sebelum merancang squad"
  });
  const webResearch = await runMotherWebResearch(effectivePrompt);

  emit({
    phase: "tools",
    label: "Central Agent ekstrak SKILL.md dari web + GitHub",
    detail: "Real-time skill extraction: GitHub repos, docs, npm, awesome-lists"
  });
  const skillDiscovery = await discoverSkillsForMission(effectivePrompt);

  emit({
    phase: "tools",
    label: `Ditemukan ${skillDiscovery.catalog.length} skills dari ${skillDiscovery.extractedDocs.length} sumber`,
    detail: `Topics: ${skillDiscovery.extractedDocs.slice(0, 3).map((d) => d.source).join(", ")}`
  });

  const synthPayload: MissionPayload = {
    ...payload,
    preferTavilySearch: true,
    contextNotes: [
      payload.contextNotes?.trim(),
      mem0Context ? `Memori dari misi sebelumnya (Mem0):\n${mem0Context}` : "",
      "Riset web Tavily otomatis sebelum spawn",
      webResearch,
      "",
      `Katalog ${skillDiscovery.catalog.length} skills (real-time dari web)`,
      skillDiscovery.researchNotes.slice(0, 4000),
      "",
      "Knowledge digest (extracted docs, SKILL.md, best practices)",
      skillDiscovery.knowledgeDigest.slice(0, 6000)
    ]
      .filter(Boolean)
      .join("\n\n")
  };

  emit({
    phase: "mother-planning",
    label: "Central Agent berpikir…",
    detail: "Mendekomposisi misi dan merancang squad specialist"
  });

  const synthPrompt = buildEffectiveMissionPrompt(synthPayload);
  const { squad, motherBrief, source, parseError } = await synthesizeSquadFromMother(synthPayload);

  for (const member of squad) {
    attachSpecialistArtifacts(member, synthPrompt);
  }

  enrichSquadWithDiscoveredSkills(squad, skillDiscovery.catalog);

  const fleetLead = squad.find((s) => s.canvasLane === "frontend") ?? squad[0];
  ensureLeadFleetReady(fleetLead, synthPrompt);
  fleetLead.subAgents = enrichSubAgentsWithDiscoveredSkills(
    fleetLead.subAgents ?? [],
    skillDiscovery.catalog,
    synthPrompt,
    skillDiscovery.knowledgeDigest
  );
  for (const member of squad) {
    refreshPlainArtifacts(member, synthPrompt);
    if (member !== fleetLead && isAutoOrchestrationEnabled()) {
      member.orchestrationMode = "openclaw";
      if (!member.specializations.includes("openclaw-orchestration")) {
        member.specializations = [...member.specializations, "openclaw-orchestration"];
      }
    }
  }

  emit({
    phase: "mother-spawn",
    label: "Central Agent menghasilkan agent",
    detail: squad.map((s) => s.name).join(", ")
  });

  emit({
    phase: "mother-review",
    label: "Review rencana",
    detail: motherBrief.slice(0, 280)
  });

  let htmlDeliverableNote: string | null = null;

  const openClawContext = buildOpenClawMissionContext({
    payload,
    effectivePrompt: synthPrompt,
    webResearch,
    fleetLead,
    squad,
    knowledgeDigest: skillDiscovery.knowledgeDigest
  });

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
  if (mem0RecallCount > 0) events.push(`Mem0: recalled ${mem0RecallCount} relevant memories`);
  events.push(`Central Agent research:\n${webResearch.slice(0, 1200)}${webResearch.length > 1200 ? "…" : ""}`);
  if (htmlDeliverableNote) events.push(htmlDeliverableNote);
  if (parseError && source === "fallback-rules") {
    events.push(`Central Agent: JSON parse error — ${parseError}`);
  }
  events.push(`Central Agent: squad via ${source}`);
  events.push(`Central brief: ${motherBrief.slice(0, 500)}${motherBrief.length > 500 ? "…" : ""}`);

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
      openClawContext,
      onProgress: (subLabel) => {
        emit({ phase: "fleet-run", label: subLabel });
      }
    });
    events.push(...fleet.events);
    fleetSummary = fleet.summary;

    emit({ phase: "fleet-merge", label: "Central Agent menggabungkan laporan fleet" });
  } else if (shouldRunOpenClaw(profile)) {
    const oc = await orchestrateViaOpenClaw({
      missionId,
      motherPrompt: synthPrompt,
      profile
    });
    events.push(oc);
  }

  emit({ phase: "tools", label: "Tool route" });
  const toolEvent = await runToolRoute(effectivePrompt, { preferTavilySearch: payload.preferTavilySearch === true });
  events.push(`Tool route: ${toolEvent}`);

  emit({
    phase: "mother-review",
    label: "Central Agent review hasil agent",
    detail: "Memeriksa setiap specialist vs misi user"
  });
  const quality = await runMotherQualityReview({
    missionPrompt: effectivePrompt,
    squad,
    fleetSummary
  });
  const motherReview = quality.reviewMarkdown;
  events.push(`Central review: ${motherReview.slice(0, 240)}${motherReview.length > 240 ? "…" : ""}`);

  emit({
    phase: "specialist-readme",
    label: "Central Agent finalisasi agent profiles",
    detail: `Meng-enrich ${squad.length} specialist dengan ${skillDiscovery.catalog.length} skills`
  });
  for (const member of squad) {
    enrichSquadWithDiscoveredSkills([member], skillDiscovery.catalog);
    if (member.subAgents?.length) {
      member.subAgents = enrichSubAgentsWithDiscoveredSkills(
        member.subAgents,
        skillDiscovery.catalog,
        synthPrompt,
        skillDiscovery.knowledgeDigest
      );
    }
    refreshPlainArtifacts(member, synthPrompt);
  }
  events.push(`Agent production: ${squad.length} specialist, total ${skillDiscovery.catalog.length} skills injected dari ${skillDiscovery.extractedDocs.length} sumber web.`);

  if (missionWantsHtmlDeliverable(synthPrompt)) {
    const fleetHint = fleetSummary?.mergedReport?.slice(0, 6000) ?? "";
    const fe = squad.find((s) => s.canvasLane === "frontend") ?? fleetLead;
    const needsHtml = !readmeHasHtmlFence(fe.readmeMd) || readmeHasFallbackHtml(fe.readmeMd);
    if (needsHtml) {
      const added = await ensureSquadHtmlDeliverables(squad, synthPrompt, {
        webResearch: `${webResearch}\n\nOpenClaw fleet report\n${fleetHint}`,
        force: true
      });
      if (added > 0) htmlDeliverableNote = `HTML untuk ${added} specialist.`;
    }
  }

  const reworkTargets = quality.verdicts.filter((v) => v.verdict === "rework");
  if (reworkTargets.length > 0) {
    emit({
      phase: "mother-review",
      label: "Central Agent rework agent",
      detail: reworkTargets.map((r) => r.agentName).join(", ")
    });
    for (const v of reworkTargets) {
      const agent = squad.find((s) => s.name === v.agentName) ?? fleetLead;
      enrichSquadWithDiscoveredSkills([agent], skillDiscovery.catalog);
      refreshPlainArtifacts(agent, synthPrompt);
      events.push(`Central Agent: re-enriched skills untuk ${agent.name}`);
    }
  }

  const centralSkillMd = buildCentralAgentSkillMd(squad, synthPrompt);
  const centralReadmeMd = buildCentralAgentReadme(squad, synthPrompt, motherBrief);

  let finalSquad = squad;
  const resultLead = fleetLead;
  const result: MissionResult = {
    missionId,
    status: "completed",
    profile: resultLead,
    specialists: finalSquad.length > 1 ? finalSquad : undefined,
    fleetSummary,
    motherBrief,
    motherReview,
    squadSource: source,
    centralSkillMd,
    centralReadmeMd,
    events
  };

  emit({ phase: "persist", label: "Menyimpan ke database" });
  try {
    const persistence = await persistMissionResult({
      prompt: effectivePrompt,
      result: {
        ...result,
        profile: resultLead,
        specialists: finalSquad.length > 1 ? finalSquad : undefined
      }
    });

    if (persistence.squadWithIds?.length) {
      finalSquad = persistence.squadWithIds.map((saved) => {
        const src = squad.find((s) => s.name === saved.name && s.role === saved.role) ?? saved;
        return {
          ...saved,
          subAgents: src.subAgents ?? saved.subAgents,
          skillMd: src.skillMd ?? saved.skillMd,
          readmeMd: src.readmeMd ?? saved.readmeMd,
          canvasLane: src.canvasLane ?? saved.canvasLane
        };
      });
      const persistedLead =
        finalSquad.find((s) => s.canvasLane === "frontend") ?? finalSquad[0];
      result.profile = persistedLead;
      result.specialists = finalSquad.length > 1 ? finalSquad : undefined;
      for (const agent of finalSquad) {
        if (agent.persistedId) {
          await updateCanvasAgentProfile(agent.persistedId, agent);
        }
      }
      events.push(
        `Canvas: ${finalSquad.length} agent tersimpan (sub-agents on lead: ${persistedLead.subAgents?.length ?? 0}).`
      );
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

  result.profile =
    finalSquad.find((s) => s.canvasLane === "frontend") ?? finalSquad[0];
  result.specialists = finalSquad.length > 1 ? finalSquad : undefined;

  try {
    const squadNames = finalSquad.map((s) => `${s.name} (${s.role})`).join(", ");
    const skillCount = finalSquad.reduce((n, s) => n + s.skills.length, 0);
    await addMemory(
      `Misi: ${effectivePrompt.slice(0, 300)}. Squad: ${squadNames}. Total ${skillCount} skills. Status: ${result.status}.`,
      {
        agentId: "central-agent",
        metadata: { missionId, agentCount: finalSquad.length, skillCount },
      }
    );
    events.push("Mem0: mission result saved to memory");
  } catch { /* mem0 optional */ }

  emit({ phase: "done", label: "Mission selesai", detail: missionId });
  return result;
}
