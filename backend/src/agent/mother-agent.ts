import type { MissionPayload, MissionResult, SpecialistAgentProfile } from "../types";
import { buildEffectiveMissionPrompt } from "./mission-prompt";
import { buildMissionGraph } from "./mission-graph";
import { orchestrateViaOpenClaw, shouldRunOpenClaw } from "./openclaw-bridge";
import { runSubAgentFleet, runSubAgentFleetWithReview } from "./fleet-orchestrator";
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

function fleetReviewMaxIterations(): number {
  const raw = Number(process.env.FLEET_REVIEW_MAX_ITERATIONS ?? "3");
  if (!Number.isFinite(raw)) return 3;
  return Math.min(5, Math.max(1, Math.floor(raw)));
}

/** Unified mission budget — tracks resource usage across the entire autonomous loop. */
class MissionBudget {
  readonly maxLlmCalls: number;
  readonly maxRuntimeMs: number;
  readonly maxReviewCycles: number;
  private llmCalls = 0;
  private readonly startMs = Date.now();
  private reviewCycles = 0;

  constructor() {
    this.maxLlmCalls = Number(process.env.MISSION_MAX_LLM_CALLS ?? "30");
    this.maxRuntimeMs = Number(process.env.MISSION_MAX_RUNTIME_MS ?? "600000");
    this.maxReviewCycles = Number(process.env.MISSION_MAX_REVIEW_CYCLES ?? "2");
  }

  trackLlmCall(count = 1): void { this.llmCalls += count; }
  trackReviewCycle(): void { this.reviewCycles++; }

  get elapsedMs(): number { return Date.now() - this.startMs; }
  get totalLlmCalls(): number { return this.llmCalls; }
  get totalReviewCycles(): number { return this.reviewCycles; }

  get canContinue(): boolean {
    return this.llmCalls < this.maxLlmCalls
      && this.elapsedMs < this.maxRuntimeMs
      && this.reviewCycles < this.maxReviewCycles;
  }

  get exhaustionReason(): string | null {
    if (this.llmCalls >= this.maxLlmCalls) return `LLM call limit (${this.maxLlmCalls})`;
    if (this.elapsedMs >= this.maxRuntimeMs) return `runtime limit (${Math.round(this.maxRuntimeMs / 1000)}s)`;
    if (this.reviewCycles >= this.maxReviewCycles) return `review cycle limit (${this.maxReviewCycles})`;
    return null;
  }

  summary(): string {
    return `Budget: ${this.llmCalls}/${this.maxLlmCalls} LLM calls, ${Math.round(this.elapsedMs / 1000)}s/${Math.round(this.maxRuntimeMs / 1000)}s runtime, ${this.reviewCycles}/${this.maxReviewCycles} review cycles`;
  }
}

export async function runMission(
  payload: MissionPayload,
  onProgress?: MissionProgressEmitter
): Promise<MissionResult> {
  const emit = createProgressEmitter(onProgress);
  const missionId = randomId(10);
  const effectivePrompt = buildEffectiveMissionPrompt(payload);
  const budget = new MissionBudget();

  emit({
    phase: "mother-planning",
    label: "Autonomous loop: PLAN phase",
    detail: `Budget: max ${budget.maxLlmCalls} LLM calls, ${Math.round(budget.maxRuntimeMs / 1000)}s runtime, ${budget.maxReviewCycles} review cycles`
  });

  emit({
    phase: "tools",
    label: "Central Agent: parallel research (Mem0 + Tavily + Skills)",
    detail: "Mem0 recall, web research, skill extraction — berjalan bersamaan"
  });

  const [mem0Result, webResearch, skillDiscovery] = await Promise.all([
    (async () => {
      try {
        const memories = await searchMemories(effectivePrompt, { agentId: "central-agent", topK: 5 });
        return { context: memories.map((m) => m.memory).join("\n"), count: memories.length };
      } catch { return { context: "", count: 0 }; }
    })(),
    runMotherWebResearch(effectivePrompt),
    discoverSkillsForMission(effectivePrompt)
  ]);

  const mem0Context = mem0Result.context;
  const mem0RecallCount = mem0Result.count;

  emit({
    phase: "tools",
    label: `Ditemukan ${skillDiscovery.catalog.length} skills dari ${skillDiscovery.extractedDocs.length} sumber`,
    detail: `Mem0: ${mem0RecallCount} memories | Topics: ${skillDiscovery.extractedDocs.slice(0, 3).map((d) => d.source).join(", ")}`
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

  const fleetLead = squad[0];
  for (const member of squad) {
    ensureLeadFleetReady(member, synthPrompt);
    member.subAgents = enrichSubAgentsWithDiscoveredSkills(
      member.subAgents ?? [],
      skillDiscovery.catalog,
      synthPrompt,
      skillDiscovery.knowledgeDigest
    );
    refreshPlainArtifacts(member, synthPrompt);
  }

  for (const member of squad) {
    emit({
      phase: "mother-spawn",
      label: `Agent spawned: ${member.name}`,
      detail: member.role,
      agentName: member.name,
      specialist: member
    });
  }

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

  const readmeEnrichTargets = squad.filter(
    (m) => source === "fallback-rules" && m.readmeMd.length < 400 && !missionWantsHtmlDeliverable(effectivePrompt)
  );
  if (readmeEnrichTargets.length > 0) {
    emit({
      phase: "specialist-readme",
      label: `Melengkapi README · ${readmeEnrichTargets.length} agent`,
      detail: readmeEnrichTargets.map((m) => m.name).join(", ")
    });
    await Promise.all(
      readmeEnrichTargets.map((member) => enrichProfileReadmeWithSumopod(member, effectivePrompt))
    );
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

  emit({
    phase: "fleet-run",
    label: "Autonomous loop: ACT phase",
    detail: "Executing fleet with plan-act-observe-decide cycle"
  });

  let fleetSummary: MissionResult["fleetSummary"];
  const squadWithSubs = squad.filter((s) => s.subAgents?.length);
  if (isAutoOrchestrationEnabled() && squadWithSubs.length > 0) {
    const totalSubs = squadWithSubs.reduce((n, s) => n + (s.subAgents?.length ?? 0), 0);
    emit({
      phase: "fleet-run",
      label: "Fleet + auto-review loop",
      detail: `${squadWithSubs.length} specialist × scout/worker/reviewer = ${totalSubs} sub-agent — iterasi sampai standar industri`
    });

    const maxIterations = fleetReviewMaxIterations();
    const allRuns: import("../types").SubAgentRunResult[] = [];
    const allMergedParts: string[] = [];

    for (const member of squadWithSubs) {
      emit({ phase: "fleet-run", label: `Fleet · ${member.name}`, detail: `Executing ${member.subAgents!.length} sub-agents for ${member.role}`, agentName: member.name });

      const fleet = await runSubAgentFleetWithReview({
        missionId,
        motherPrompt: synthPrompt,
        profile: member,
        openClawContext,
        maxIterations,
        onProgress: (subLabel, agentName) => {
          emit({ phase: "fleet-run", label: subLabel, agentName: agentName ?? member.name });
        }
      });
      events.push(...fleet.events);
      for (const run of fleet.summary.subAgentRuns) {
        allRuns.push(run);
        emit({ phase: "fleet-run", label: `Fleet result · ${run.role}`, agentName: member.name, fleetRun: run });
      }
      if (fleet.summary.mergedReport) allMergedParts.push(`## ${member.name} (${member.role})\n\n${fleet.summary.mergedReport}`);
      budget.trackLlmCall(fleet.iterations * (member.subAgents?.length ?? 1) + fleet.iterations);
    }

    fleetSummary = {
      mergedReport: allMergedParts.join("\n\n---\n\n"),
      subAgentRuns: allRuns
    };

    emit({ phase: "fleet-merge", label: `Central Agent merge (${squadWithSubs.length} specialists)` });
  } else if (shouldRunOpenClaw(profile)) {
    const oc = await orchestrateViaOpenClaw({
      missionId,
      motherPrompt: synthPrompt,
      profile
    });
    events.push(oc);
  }

  emit({
    phase: "mother-review",
    label: "Central Agent: parallel finalize (tool route + quality review)",
    detail: "Memeriksa setiap specialist vs misi user"
  });

  const [toolEvent, quality] = await Promise.all([
    runToolRoute(effectivePrompt, { preferTavilySearch: payload.preferTavilySearch === true }),
    runMotherQualityReview({ missionPrompt: effectivePrompt, squad, fleetSummary })
  ]);
  events.push(`Tool route: ${toolEvent}`);
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

  emit({
    phase: "mother-review",
    label: "Autonomous loop: OBSERVE phase",
    detail: `${quality.verdicts.filter((v) => v.verdict === "pass").length} pass, ${quality.verdicts.filter((v) => v.verdict === "rework").length} rework`
  });

  const reworkTargets = quality.verdicts.filter((v) => v.verdict === "rework");
  budget.trackLlmCall();

  if (reworkTargets.length > 0 && budget.canContinue) {
    budget.trackReviewCycle();
    emit({
      phase: "mother-review",
      label: "Autonomous loop: DECIDE → REWORK",
      detail: `Re-running ${reworkTargets.length} agent(s): ${reworkTargets.map((r) => r.agentName).join(", ")} | ${budget.summary()}`
    });

    for (const v of reworkTargets) {
      const agent = squad.find((s) => s.name === v.agentName) ?? fleetLead;
      enrichSquadWithDiscoveredSkills([agent], skillDiscovery.catalog);
      refreshPlainArtifacts(agent, synthPrompt);

      if (agent.subAgents?.length && isAutoOrchestrationEnabled() && budget.canContinue) {
        emit({
          phase: "fleet-run",
          label: `Re-run fleet · ${agent.name}`,
          detail: v.instructions ?? "Rework berdasarkan review feedback"
        });

        const reworkContext = buildOpenClawMissionContext({
          payload,
          effectivePrompt: synthPrompt,
          webResearch,
          fleetLead: agent,
          squad,
          knowledgeDigest: skillDiscovery.knowledgeDigest,
          fleetMergedReport: fleetSummary?.mergedReport
        });

        const reworkFleet = await runSubAgentFleetWithReview({
          missionId,
          motherPrompt: `${synthPrompt}\n\nREWORK INSTRUCTIONS: ${v.instructions ?? "Improve quality to meet industry standards."}`,
          profile: agent,
          openClawContext: reworkContext,
          maxIterations: 2,
          onProgress: (subLabel, agName) => {
            emit({ phase: "fleet-run", label: `Rework · ${subLabel}`, agentName: agName ?? agent.name });
          }
        });
        events.push(...reworkFleet.events);
        budget.trackLlmCall(reworkFleet.iterations * (agent.subAgents?.length ?? 1));

        if (fleetSummary && reworkFleet.summary.mergedReport) {
          fleetSummary = {
            mergedReport: reworkFleet.summary.mergedReport,
            subAgentRuns: [
              ...fleetSummary.subAgentRuns.filter(
                (r) => !reworkFleet.summary.subAgentRuns.some((rr) => rr.id === r.id)
              ),
              ...reworkFleet.summary.subAgentRuns
            ]
          };
        }
        events.push(`Autonomous rework: ${agent.name} re-executed (${reworkFleet.iterations} iter, ${reworkFleet.summary.subAgentRuns.length} sub-agents)`);
      } else {
        events.push(`Central Agent: re-enriched skills untuk ${agent.name} (no fleet re-run — budget: ${budget.summary()})`);
      }
    }

    emit({
      phase: "mother-review",
      label: "Autonomous loop: OBSERVE (post-rework)",
      detail: budget.summary()
    });
  } else if (reworkTargets.length > 0) {
    events.push(`Autonomous loop: rework needed but budget exhausted — ${budget.exhaustionReason}. Delivering best available output.`);
    emit({
      phase: "mother-review",
      label: "Autonomous loop: DECIDE → DELIVER (budget limit)",
      detail: budget.exhaustionReason ?? ""
    });
  } else {
    events.push("Autonomous loop: all agents PASS quality review.");
    emit({
      phase: "mother-review",
      label: "Autonomous loop: DECIDE → DELIVER (all pass)",
      detail: budget.summary()
    });
  }

  events.push(`Autonomous loop complete. ${budget.summary()}`);

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
