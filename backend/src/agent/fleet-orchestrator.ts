import type { FleetOrchestrationSummary, SpecialistAgentProfile, SubAgentDescriptor, SubAgentRunResult } from "../types";
import { isOpenAiCompatConfigured, openAiCompatibleChatCompletion } from "../compat/openai-compatible-chat";
import { logger } from "../logging";
import { isOpenClawOrchestrationEnabled } from "./specializations";
import { runOpenClawAgentMessage } from "./openclaw-bridge";

function sanitizeGatewayErrorMessage(raw: string): string {
  let m = raw.replace(/Bearer\s+sk-[^\s"'<]+/gi, "Bearer [redacted]");
  m = m.replace(/\bsk-[a-zA-Z0-9_-]{8,}\b/g, "[redacted]");
  return m.length > 450 ? `${m.slice(0, 447)}…` : m;
}

function gatewayFailureHint(detail: string): string {
  const d = detail.toLowerCase();
  if (d.includes("402") || d.includes("insufficient balance")) {
    return [
      "**Penyebab:** bukan saldo **SumoPod Credit** kamu — error ini dari **pool provider DeepSeek** di sisi SumoPod (upstream `Insufficient Balance`). Kredit ~$3 kamu bisa tetap ada sementara route `deepseek/deepseek-v4-pro` ditolak.",
      "**Perbaikan cepat:** set `OPENAI_COMPAT_MODEL=gemini/gemini-2.5-flash` (tes dari mesin ini: Gemini **200 OK** dengan key yang sama). Atau tunggu SumoPod memulihkan route DeepSeek / hubungi support.",
      "Backend juga bisa auto-retry `OPENAI_COMPAT_FALLBACK_MODEL` (default `gemini/gemini-2.5-flash` bila primary DeepSeek). **Restart backend** setelah ubah `.env`."
    ].join("\n");
  }
  if (d.includes("401") || d.includes("invalid api key") || d.includes("authentication")) {
    return "**Penyebab:** bearer/API key ditolak. Cek `OPENAI_COMPAT_API_KEY` atau `DEEPSEEK_API_KEY` di `backend/.env`, lalu restart backend.";
  }
  if (d.includes("429") || d.includes("rate limit")) {
    return "**Penyebab:** rate limit upstream. Tunggu sebentar atau turunkan beban mission; fleet bisa fallback ke OpenClaw.";
  }
  return "_Cek: kuota/key, `OPENAI_COMPAT_MODEL`, koneksi worker → upstream, dan log backend._";
}

function formatGatewayFailureBlock(detail: string): string {
  return [
    "_Gateway OpenAI-compatible sudah di-set tetapi **permintaan gagal** — mencoba fallback lain jika tersedia._",
    "",
    gatewayFailureHint(detail),
    "",
    "**Ringkas error (tanpa menampilkan key):**",
    "```text",
    sanitizeGatewayErrorMessage(detail),
    "```"
  ].join("\n");
}

function fleetMaxTokensPerSub(): number {
  const n = Number(process.env.FLEET_MAX_TOKENS_PER_SUB ?? "1400");
  return Number.isFinite(n) && n > 200 ? n : 1400;
}

function fleetMergeMaxTokens(): number {
  const n = Number(process.env.FLEET_MERGE_MAX_TOKENS ?? "2200");
  return Number.isFinite(n) && n > 400 ? n : 2200;
}

function buildSkillInstructionsBlock(profile: SpecialistAgentProfile): string {
  const withInstructions = profile.skills.filter((sk) => sk.instructions?.trim());
  if (withInstructions.length === 0) return "";
  const blocks = withInstructions.slice(0, 8).map((sk) =>
    `### ${sk.label} (${sk.kind})\n${sk.instructions!.trim().slice(0, 1200)}`
  );
  return ["", "DETAILED SKILL INSTRUCTIONS — use this knowledge in your output:", "", ...blocks, ""].join("\n");
}

function buildSubUserPayload(params: {
  motherPrompt: string;
  profile: SpecialistAgentProfile;
  sub: SubAgentDescriptor;
  priorOutputs: string;
  openClawContext?: string;
  reviewFeedback?: string;
}): string {
  const skillInstructions = buildSkillInstructionsBlock(params.profile);

  return [
    "OpenClaw mission pack (SKILL, URLs, Tavily research)",
    params.openClawContext?.trim() || params.motherPrompt.trim(),
    "",
    "Lead specialist",
    `Name ${params.profile.name}`,
    `Role ${params.profile.role}`,
    `Purpose ${params.profile.purpose}`,
    `System instructions: ${params.profile.systemInstructions.slice(0, 800)}`,
    params.profile.readmeMd?.trim()
      ? ["", "Lead README.md (agent identity & capabilities)", params.profile.readmeMd.trim().slice(0, 2000), ""].join("\n")
      : "",
    params.profile.skillMd?.trim()
      ? ["", "Lead SKILL.md", params.profile.skillMd.trim().slice(0, 3000), ""].join("\n")
      : "",
    skillInstructions,
    params.sub.skillMd?.trim()
      ? ["", "Sub-agent SKILL (role-specific)", params.sub.skillMd.trim().slice(0, 3000), ""].join("\n")
      : "",
    "Your sub-agent assignment",
    `id ${params.sub.id}`,
    `role ${params.sub.role}`,
    `focus ${params.sub.focus}`,
    "",
    "Outputs from earlier sub-agents (read-only)",
    params.priorOutputs.trim() || "None yet, you are first in the chain.",
    "",
    params.reviewFeedback
      ? [
          "REWORK INSTRUCTIONS FROM REVIEWER — you MUST address these issues:",
          params.reviewFeedback,
          "",
          "Improve your output to meet industry/world-class standards based on this feedback."
        ].join("\n")
      : "",
    "Produce only your slice. Apply ALL injected skills and instructions to produce expert-level, industry-standard output.",
    "Do not claim you ran tools unless context says so."
  ].join("\n");
}

async function runSubViaOpenAiCompat(params: {
  motherPrompt: string;
  profile: SpecialistAgentProfile;
  sub: SubAgentDescriptor;
  priorOutputs: string;
  openClawContext?: string;
  reviewFeedback?: string;
}): Promise<string | null> {
  if (!isOpenAiCompatConfigured()) return null;
  const roleInstructions = params.sub.role.includes("scout")
    ? [
        "As SCOUT, your job is to research, analyze, and provide a structured intelligence brief.",
        "Your output MUST include:",
        "1. **Executive Summary** — 2-3 sentence verdict with confidence score (1-10)",
        "2. **Key Findings** — bullet list with specific data points, numbers, metrics, percentages",
        "3. **Competitive/Market Analysis** — comparison table or matrix with scores",
        "4. **Risk Assessment** — scored risks (Critical/High/Medium/Low) with mitigation notes",
        "5. **Data Sources** — what you analyzed and methodology notes",
        "Use tables, scores (1-10), traffic lights (🟢🟡🔴), and quantified metrics wherever possible."
      ].join("\n")
    : params.sub.role.includes("reviewer")
    ? [
        "As REVIEWER, evaluate the scout and worker outputs against industry standards.",
        "Your output MUST include:",
        "1. **Verdict** — APPROVE / NEEDS WORK / REJECT with overall score (1-100)",
        "2. **Dimension Scores** — rate each dimension 1-10: Completeness, Accuracy, Actionability, Depth, Structure",
        "3. **Critical Issues** — must-fix items before delivery",
        "4. **Strengths** — what's done well (always include at least 2)",
        "5. **Improvement Recommendations** — prioritized list with effort estimates",
        "6. **Final Checklist** — ✅/❌ for each mission requirement",
        "Be strict but constructive. Use scoring matrices and structured tables."
      ].join("\n")
    : [
        "As WORKER, you produce the primary deliverable — the core output of this mission.",
        "Your output MUST be comprehensive, structured, and immediately actionable:",
        "1. **Executive Summary** — key conclusions with confidence/quality scores",
        "2. **Detailed Analysis/Deliverable** — the main body with subsections, each containing:",
        "   - Specific findings, recommendations, or implementations",
        "   - Quantified metrics, scores, or benchmarks where applicable",
        "   - Actionable next steps with priority (P0/P1/P2) and effort (hours/days)",
        "3. **Comparison/Decision Matrix** — tables comparing options, approaches, or findings",
        "4. **Implementation Roadmap** — phased plan with timeline estimates",
        "5. **Success Metrics** — how to measure if the output achieved its goal",
        "Use tables, scoring matrices, priority tags, and structured frameworks. NEVER produce a wall of plain text."
      ].join("\n");

  const system = [
    "You are a specialized sub-agent in a multi-agent fleet coordinated by a Central Agent.",
    "You have been produced with real-time skills extracted from the web — SKILL.md files, documentation, best practices.",
    "",
    roleInstructions,
    "",
    "CRITICAL OUTPUT RULES:",
    "- ALWAYS use Markdown tables for comparisons and scores",
    "- ALWAYS include quantified metrics (numbers, percentages, scores 1-10)",
    "- ALWAYS structure output with clear H2/H3 headers",
    "- NEVER produce generic advice — be specific, data-driven, actionable",
    "- If the mission is about validation/analysis, include a clear VERDICT with reasoning",
    "Stay inside your sub-agent role. Be factual; do not claim you ran tools unless context says so.",
    params.reviewFeedback ? "IMPORTANT: REWORK mode — address ALL reviewer feedback points." : "",
    "Reply in Markdown. Indonesian if the user mission is Indonesian."
  ].filter(Boolean).join("\n");

  const user = buildSubUserPayload({ ...params, reviewFeedback: params.reviewFeedback });

  try {
    const fleetTimeout = Number(process.env.FLEET_LLM_TIMEOUT_MS ?? process.env.MOTHER_LLM_TIMEOUT_MS ?? "60000");
    return await openAiCompatibleChatCompletion({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      maxTokens: fleetMaxTokensPerSub(),
      temperature: params.reviewFeedback ? 0.3 : 0.45,
      timeoutMs: Number.isFinite(fleetTimeout) && fleetTimeout > 10_000 ? fleetTimeout : 120_000
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.warn({ err, subId: params.sub.id }, "OpenAI-compat fleet sub-agent call failed");
    throw new Error(detail);
  }
}

async function runSubViaOpenClaw(params: {
  missionId: string;
  motherPrompt: string;
  profile: SpecialistAgentProfile;
  sub: SubAgentDescriptor;
  priorOutputs: string;
  openClawContext?: string;
  reviewFeedback?: string;
}): Promise<string | null> {
  if (process.env.OPENCLAW_ORCHESTRATION === "0") return null;

  const sessionId =
    process.env.OPENCLAW_SESSION_PREFIX != null
      ? `${process.env.OPENCLAW_SESSION_PREFIX}-${params.missionId}-${params.sub.id}`
      : `recursive-agent-${params.missionId}-${params.sub.id}`;

  const skillBlock = buildSkillInstructionsBlock(params.profile);

  const message = [
    `You are sub-agent ${params.sub.id} with role ${params.sub.role}.`,
    `Focus: ${params.sub.focus}`,
    `System: ${params.profile.systemInstructions.slice(0, 600)}`,
    "",
    params.openClawContext?.trim() ||
      ["## User mission", params.motherPrompt.trim(), "", `Lead: ${params.profile.purpose}`].join("\n"),
    skillBlock,
    "",
    "## Prior sub-agent outputs",
    params.priorOutputs.trim() || "(none)",
    "",
    params.reviewFeedback
      ? ["## REWORK — address these issues:", params.reviewFeedback, ""].join("\n")
      : "",
    "Apply ALL injected skills to produce industry-standard output. Respond with Markdown only."
  ].join("\n");

  try {
    const out = await runOpenClawAgentMessage({ message, sessionId });
    const t = out.trim();
    if (
      !t ||
      t.includes("OPENCLAW_ORCHESTRATION=0") ||
      t.startsWith("openclaw: CLI not available")
    ) {
      return null;
    }
    return out.replace(/^openclaw:\s*/i, "").trim() || null;
  } catch {
    return null;
  }
}

function concatMergeReport(params: {
  missionId: string;
  motherPrompt: string;
  profile: SpecialistAgentProfile;
  runs: SubAgentRunResult[];
}): string {
  const parts = [
    `# Fleet report -> Central Agent`,
    "",
    `**Mission id:** \`${params.missionId}\``,
    `**Lead:** ${params.profile.name} (\`${params.profile.role}\`)`,
    "",
    "## Original mission",
    "```text",
    params.motherPrompt.trim(),
    "```",
    ""
  ];
  for (const r of params.runs) {
    parts.push(`## Sub-agent \`${r.id}\` — ${r.role}`, `_Source: ${r.source}_`, "", r.output || "_No output._", "");
  }
  return parts.join("\n");
}

async function synthesizeMergeIfPossible(
  motherPrompt: string,
  profile: SpecialistAgentProfile,
  runs: SubAgentRunResult[]
): Promise<string | null> {
  if (!isOpenAiCompatConfigured()) return null;
  const bundle = runs.map((r) => `### ${r.role} (${r.id})\n${r.output}`).join("\n\n---\n\n");
  try {
    return await openAiCompatibleChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are the Central Agent synthesizing a fleet of knowledge-enriched agents. Merge sub-agent outputs into one executive report: what knowledge was applied, what each agent contributed, quality assessment, risks, and ordered next steps. Highlight the real-time skills and web knowledge that made these agents smarter. Markdown. Match user language (e.g. Indonesian if mission is Indonesian). Do not invent tool executions."
        },
        {
          role: "user",
          content: `Lead specialist: ${profile.name} (${profile.role})\n\nMission:\n${motherPrompt.slice(0, 4000)}\n\n---\n\nSub-agent outputs:\n${bundle.slice(0, 12000)}`
        }
      ],
      maxTokens: fleetMergeMaxTokens(),
      temperature: 0.35
    });
  } catch {
    return null;
  }
}

/**
 * Runs each `profile.subAgents` entry **sequentially** (context carries forward), then builds a **merged report** for the Central Agent.
 * Prefers OpenAI-compatible gateway when configured; otherwise attempts one OpenClaw CLI call per sub-agent.
 */
export async function runSubAgentFleet(params: {
  missionId: string;
  motherPrompt: string;
  profile: SpecialistAgentProfile;
  /** SKILL.md + URLs + Tavily + mission text for OpenClaw. */
  openClawContext?: string;
  onProgress?: (label: string, agentName?: string) => void;
}): Promise<{ events: string[]; summary: FleetOrchestrationSummary }> {
  const subs = params.profile.subAgents ?? [];
  const events: string[] = [];
  if (subs.length === 0) {
    return {
      events: ["Fleet: no sub-agents on profile — skipped."],
      summary: { mergedReport: "", subAgentRuns: [] }
    };
  }

  events.push(`Fleet: executing ${subs.length} sub-agent(s) sequentially (outputs feed forward).`);

  const runs: SubAgentRunResult[] = [];
  let prior = "";
  const gatewayFailures: string[] = [];

  for (const sub of subs) {
    params.onProgress?.(`Executing · ${sub.role}`, params.profile.name);
    events.push(`Fleet: start ${sub.role} (\`${sub.id}\`)`);

    let output: string | null = null;
    let source: SubAgentRunResult["source"] = "skipped";
    let compatError: string | null = null;
    const preferOpenClaw = isOpenClawOrchestrationEnabled();

    const runCompat = async () => {
      try {
        return await runSubViaOpenAiCompat({
          motherPrompt: params.motherPrompt,
          profile: params.profile,
          sub,
          priorOutputs: prior,
          openClawContext: params.openClawContext
        });
      } catch (err) {
        compatError = err instanceof Error ? err.message : String(err);
        gatewayFailures.push(compatError);
        events.push(`Fleet: OpenAI-compat failed for ${sub.id}${preferOpenClaw ? "" : " — trying OpenClaw"}.`);
        return null;
      }
    };

    const runClaw = async () =>
      runSubViaOpenClaw({
        missionId: params.missionId,
        motherPrompt: params.motherPrompt,
        profile: params.profile,
        sub,
        priorOutputs: prior,
        openClawContext: params.openClawContext
      });

    if (preferOpenClaw) {
      output = await runClaw();
      if (output) source = "openclaw";
      if (!output) {
        output = await runCompat();
        if (output) source = "openai-compat";
      }
    } else {
      output = await runCompat();
      if (output) source = "openai-compat";
      if (!output) {
        output = await runClaw();
        if (output) source = "openclaw";
      }
    }

    if (!output) {
      if (compatError) {
        output = formatGatewayFailureBlock(compatError);
        source = "skipped";
      } else {
        output =
          "_No LLM gateway (OPENAI_COMPAT_*) and OpenClaw unavailable or OPENCLAW_ORCHESTRATION=0 — configure SumoPod/OpenAI-compat or enable OpenClaw for this sub-agent._";
        source = "skipped";
      }
    }

    runs.push({ id: sub.id, role: sub.role, focus: sub.focus, output, source });
    prior += `\n\n### ${sub.role} (${sub.id})\n${output}`;
    params.onProgress?.(`Done · ${sub.role} [${source}]`, params.profile.name);
    events.push(`Fleet: done ${sub.role} (${output.length} chars, source=${source})`);
  }

  const stitched = concatMergeReport({
    missionId: params.missionId,
    motherPrompt: params.motherPrompt,
    profile: params.profile,
    runs
  });

  if (gatewayFailures.length > 0) {
    const last = gatewayFailures[gatewayFailures.length - 1]!;
    events.push(`Fleet: OpenAI-compat errors (${gatewayFailures.length}) — last: ${sanitizeGatewayErrorMessage(last).slice(0, 120)}`);
  }

  const synthesized = await synthesizeMergeIfPossible(params.motherPrompt, params.profile, runs);
  const mergedReport = synthesized
    ? [
        `# Central Agent - synthesized fleet report`,
        "",
        synthesized.trim(),
        "",
        "---",
        "",
        "## Raw per-sub outputs (appendix)",
        "",
        stitched
      ].join("\n")
    : stitched;

  events.push(`Fleet: merge complete (${mergedReport.length} chars).`);

  return { events, summary: { mergedReport, subAgentRuns: runs } };
}

/**
 * Reviews fleet output via LLM and returns rework instructions per sub-agent.
 * Returns null if all sub-agents pass or gateway unavailable.
 */
async function reviewFleetOutput(params: {
  motherPrompt: string;
  profile: SpecialistAgentProfile;
  runs: SubAgentRunResult[];
  iteration: number;
}): Promise<{ pass: boolean; feedback: Record<string, string> } | null> {
  if (!isOpenAiCompatConfigured()) return null;

  const runSummaries = params.runs
    .filter((r) => r.source !== "skipped")
    .map((r) => `### ${r.role} (${r.id})\n${r.output.slice(0, 2000)}`)
    .join("\n\n---\n\n");

  try {
    const raw = await openAiCompatibleChatCompletion({
      messages: [
        {
          role: "system",
          content: [
            `You are a world-class quality reviewer (iteration ${params.iteration}).`,
            "Review each sub-agent output against INDUSTRY/WORLD-CLASS standards.",
            "Evaluate: depth of expertise, actionability, completeness, structure, and whether it demonstrates real specialist knowledge.",
            "Return ONLY JSON:",
            '{ "allPass": true/false, "reviews": [{ "subId": "id", "pass": true/false, "feedback": "specific improvement instructions if not pass" }] }',
            "Set allPass=true ONLY when ALL outputs meet professional/industry standards.",
            "Be strict but fair. Generic or surface-level output = fail. Expert-level, actionable, comprehensive = pass."
          ].join(" ")
        },
        {
          role: "user",
          content: `Mission:\n${params.motherPrompt.slice(0, 2000)}\n\nLead: ${params.profile.name} (${params.profile.role})\n\nSub-agent outputs:\n${runSummaries.slice(0, 10000)}`
        }
      ],
      maxTokens: 1200,
      temperature: 0.2,
      timeoutMs: 60_000
    });

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (fenced?.[1] ?? raw).trim();
    const start = candidate.indexOf("{");
    let depth = 0, end = -1;
    for (let i = start; i < candidate.length; i++) {
      if (candidate[i] === "{") depth++;
      else if (candidate[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (start === -1 || end === -1) return null;

    const data = JSON.parse(candidate.slice(start, end + 1)) as {
      allPass?: boolean;
      reviews?: { subId: string; pass: boolean; feedback: string }[];
    };

    const feedback: Record<string, string> = {};
    if (Array.isArray(data.reviews)) {
      for (const r of data.reviews) {
        if (!r.pass && r.feedback) {
          feedback[r.subId] = r.feedback;
        }
      }
    }

    return { pass: data.allPass === true && Object.keys(feedback).length === 0, feedback };
  } catch (err) {
    logger.warn({ err }, "Fleet review LLM call failed");
    return null;
  }
}

/**
 * Lightweight recursive decomposition: splits a failed sub-agent's task into 2-3 child sub-agents.
 * Children inherit parent's skills and context — no extra web research or skill extraction.
 */
async function decomposeAndRunChildren(params: {
  missionId: string;
  motherPrompt: string;
  profile: SpecialistAgentProfile;
  parentSub: SubAgentDescriptor;
  parentOutput: string;
  priorOutputs: string;
  openClawContext?: string;
  onProgress?: (label: string, agentName?: string) => void;
}): Promise<SubAgentRunResult[]> {
  if (!isOpenAiCompatConfigured()) return [];

  let decomposition: { children: { role: string; focus: string }[] } | null = null;
  try {
    const raw = await openAiCompatibleChatCompletion({
      messages: [
        {
          role: "system",
          content: [
            "You decompose a complex agent task into 2-3 smaller, focused child tasks.",
            "Return ONLY JSON: { \"children\": [{ \"role\": \"child-role\", \"focus\": \"specific narrow focus\" }] }",
            "Each child should handle a distinct slice of the parent task. Max 3 children."
          ].join(" ")
        },
        {
          role: "user",
          content: `Parent role: ${params.parentSub.role}\nParent focus: ${params.parentSub.focus}\nParent output (too shallow):\n${params.parentOutput.slice(0, 1000)}\n\nDecompose into focused children.`
        }
      ],
      maxTokens: 600,
      temperature: 0.3,
      timeoutMs: 30_000
    });

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (fenced?.[1] ?? raw).trim();
    const start = candidate.indexOf("{");
    let depth = 0, end = -1;
    for (let i = start; i < candidate.length; i++) {
      if (candidate[i] === "{") depth++;
      else if (candidate[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (start >= 0 && end >= 0) {
      decomposition = JSON.parse(candidate.slice(start, end + 1));
    }
  } catch {
    return [];
  }

  if (!decomposition?.children?.length) return [];

  const children = decomposition.children.slice(0, 3);
  const childRuns: SubAgentRunResult[] = [];
  let childPrior = params.priorOutputs;

  for (const child of children) {
    const childSub: SubAgentDescriptor = {
      id: `${params.parentSub.id}-child-${child.role.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20)}`,
      role: child.role,
      focus: child.focus
    };

    params.onProgress?.(`Child · ${child.role}`, params.profile.name);

    let output: string | null = null;
    let source: SubAgentRunResult["source"] = "skipped";

    try {
      output = await runSubViaOpenAiCompat({
        motherPrompt: params.motherPrompt,
        profile: params.profile,
        sub: childSub,
        priorOutputs: childPrior,
        openClawContext: params.openClawContext
      });
      if (output) source = "openai-compat";
    } catch { /* fallback */ }

    if (!output) {
      output = await runSubViaOpenClaw({
        missionId: params.missionId,
        motherPrompt: params.motherPrompt,
        profile: params.profile,
        sub: childSub,
        priorOutputs: childPrior,
        openClawContext: params.openClawContext
      });
      if (output) source = "openclaw";
    }

    if (output) {
      childRuns.push({ id: childSub.id, role: `child:${child.role}`, focus: child.focus, output, source });
      childPrior += `\n\n### child:${child.role}\n${output}`;
    }
  }

  return childRuns;
}

/**
 * Runs the fleet with auto-review loop: execute → review → rework failing agents → repeat.
 * Stops when all pass or max iterations reached. Supports recursive decomposition.
 */
export async function runSubAgentFleetWithReview(params: {
  missionId: string;
  motherPrompt: string;
  profile: SpecialistAgentProfile;
  openClawContext?: string;
  onProgress?: (label: string, agentName?: string) => void;
  maxIterations?: number;
}): Promise<{ events: string[]; summary: FleetOrchestrationSummary; iterations: number }> {
  const maxIter = params.maxIterations ?? 3;
  let iteration = 0;
  let lastResult = await runSubAgentFleet(params);
  iteration++;

  const allEvents = [...lastResult.events];
  let currentRuns = lastResult.summary.subAgentRuns;

  while (iteration < maxIter) {
    params.onProgress?.(`Review iterasi ${iteration}/${maxIter}`, params.profile.name);
    allEvents.push(`Fleet review: iteration ${iteration} — evaluating output quality...`);

    const review = await reviewFleetOutput({
      motherPrompt: params.motherPrompt,
      profile: params.profile,
      runs: currentRuns,
      iteration
    });

    if (!review) {
      allEvents.push("Fleet review: reviewer unavailable — accepting current output.");
      break;
    }

    if (review.pass) {
      allEvents.push(`Fleet review: ALL PASS at iteration ${iteration} — industry-standard quality achieved.`);
      params.onProgress?.(`Quality PASS ✓`, params.profile.name);
      break;
    }

    const failedIds = Object.keys(review.feedback);
    allEvents.push(`Fleet review: ${failedIds.length} sub-agent(s) need rework: ${failedIds.join(", ")}`);
    params.onProgress?.(`Rework ${failedIds.length} agent`, params.profile.name);

    const subs = params.profile.subAgents ?? [];
    const prior = currentRuns
      .map((r) => `\n\n### ${r.role} (${r.id})\n${r.output}`)
      .join("");

    const reworkPromises = currentRuns.map(async (run): Promise<{ run: SubAgentRunResult; extra: SubAgentRunResult[]; events: string[] }> => {
      const localEvents: string[] = [];
      const feedback = review.feedback[run.id];
      if (!feedback || run.source === "skipped") {
        return { run, extra: [], events: localEvents };
      }

      const sub = subs.find((s) => s.id === run.id);
      if (!sub) return { run, extra: [], events: localEvents };

      localEvents.push(`Fleet rework: re-running ${run.role} (${run.id}) with feedback`);
      params.onProgress?.(`Rework · ${run.role}`, params.profile.name);

      let output: string | null = null;
      let source: SubAgentRunResult["source"] = "skipped";
      const preferOpenClaw = isOpenClawOrchestrationEnabled();

      if (preferOpenClaw) {
        output = await runSubViaOpenClaw({
          missionId: params.missionId,
          motherPrompt: params.motherPrompt,
          profile: params.profile,
          sub,
          priorOutputs: prior,
          openClawContext: params.openClawContext,
          reviewFeedback: feedback
        });
        if (output) source = "openclaw";
      }

      if (!output) {
        try {
          output = await runSubViaOpenAiCompat({
            motherPrompt: params.motherPrompt,
            profile: params.profile,
            sub,
            priorOutputs: prior,
            openClawContext: params.openClawContext,
            reviewFeedback: feedback
          });
          if (output) source = "openai-compat";
        } catch { /* fallback */ }
      }

      if (!output) {
        localEvents.push(`Fleet rework: ${run.id} rework failed — keeping previous output`);
        return { run, extra: [], events: localEvents };
      }

      if (output.length < 300 && iteration >= 2) {
        localEvents.push(`Fleet decompose: ${run.id} output too shallow — spawning child agents`);
        params.onProgress?.(`Decompose · ${run.role} → child agents`, params.profile.name);

        const childRuns = await decomposeAndRunChildren({
          missionId: params.missionId,
          motherPrompt: params.motherPrompt,
          profile: params.profile,
          parentSub: sub,
          parentOutput: output,
          priorOutputs: prior,
          openClawContext: params.openClawContext,
          onProgress: params.onProgress,
        });

        if (childRuns.length > 0) {
          const merged = childRuns.map((cr) => cr.output).join("\n\n---\n\n");
          const compositeRun: SubAgentRunResult = {
            id: run.id,
            role: `${run.role} (decomposed → ${childRuns.length} children)`,
            focus: run.focus,
            output: `## Decomposed output (${childRuns.length} child agents)\n\n${merged}`,
            source: childRuns[0]?.source ?? "openai-compat"
          };
          localEvents.push(`Fleet decompose: ${run.id} produced ${childRuns.length} child agents`);
          return { run: compositeRun, extra: childRuns, events: localEvents };
        }

        localEvents.push(`Fleet decompose: ${run.id} decomposition failed — keeping reworked output`);
        return { run: { ...run, output, source }, extra: [], events: localEvents };
      }

      localEvents.push(`Fleet rework: ${run.id} improved (${output.length} chars, source=${source})`);
      return { run: { ...run, output, source }, extra: [], events: localEvents };
    });

    const reworkResults = await Promise.all(reworkPromises);
    const updatedRuns: SubAgentRunResult[] = [];
    for (const r of reworkResults) {
      updatedRuns.push(r.run);
      for (const e of r.extra) updatedRuns.push(e);
      allEvents.push(...r.events);
    }

    currentRuns = updatedRuns;
    iteration++;
  }

  if (iteration >= maxIter) {
    allEvents.push(`Fleet review: max iterations (${maxIter}) reached — delivering best output.`);
  }

  const stitched = concatMergeReport({
    missionId: params.missionId,
    motherPrompt: params.motherPrompt,
    profile: params.profile,
    runs: currentRuns
  });

  const synthesized = await synthesizeMergeIfPossible(params.motherPrompt, params.profile, currentRuns);
  const mergedReport = synthesized
    ? [
        `# Central Agent - synthesized fleet report (${iteration} iteration${iteration > 1 ? "s" : ""})`,
        "",
        synthesized.trim(),
        "",
        "---",
        "",
        "## Raw per-sub outputs (appendix)",
        "",
        stitched
      ].join("\n")
    : stitched;

  allEvents.push(`Fleet: final merge complete after ${iteration} iteration(s) (${mergedReport.length} chars).`);

  return {
    events: allEvents,
    summary: { mergedReport, subAgentRuns: currentRuns },
    iterations: iteration
  };
}
