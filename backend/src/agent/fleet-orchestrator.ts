import type { FleetOrchestrationSummary, SpecialistAgentProfile, SubAgentRunResult } from "../types";
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

function buildSubUserPayload(params: {
  motherPrompt: string;
  profile: SpecialistAgentProfile;
  sub: { id: string; role: string; focus: string };
  priorOutputs: string;
  browserContext?: string;
}): string {
  return [
    "## User mission (source of truth)",
    params.motherPrompt.trim(),
    "",
    "## Lead specialist",
    `- Name: ${params.profile.name}`,
    `- Role: ${params.profile.role}`,
    `- Purpose: ${params.profile.purpose}`,
    "",
    "## Your sub-agent assignment",
    `- id: \`${params.sub.id}\``,
    `- role: \`${params.sub.role}\``,
    `- focus: ${params.sub.focus}`,
    "",
    params.browserContext
      ? ["## Browser / extract context (may be empty)", params.browserContext.trim(), ""].join("\n")
      : "",
    "## Outputs from earlier sub-agents in this fleet (read-only; build on them)",
    params.priorOutputs.trim() || "_None yet — you are first in the chain._",
    "",
    "Produce **only** your slice of the work: concrete bullets, risks, and next actions. Markdown. Do not repeat the full mission verbatim."
  ].join("\n");
}

async function runSubViaOpenAiCompat(params: {
  motherPrompt: string;
  profile: SpecialistAgentProfile;
  sub: { id: string; role: string; focus: string };
  priorOutputs: string;
  browserContext?: string;
}): Promise<string | null> {
  if (!isOpenAiCompatConfigured()) return null;
  const system = [
    "You are one leg of a multi-agent fleet coordinated by a mother agent.",
    "Stay inside your sub-agent role and focus. Be factual; do not claim you executed shell commands or external tools unless context says so.",
    "Reply in Markdown. Indonesian if the user mission is Indonesian."
  ].join(" ");

  const user = buildSubUserPayload(params);

  try {
    const fleetTimeout = Number(process.env.FLEET_LLM_TIMEOUT_MS ?? process.env.MOTHER_LLM_TIMEOUT_MS ?? "120000");
    return await openAiCompatibleChatCompletion({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      maxTokens: fleetMaxTokensPerSub(),
      temperature: 0.45,
      timeoutMs: Number.isFinite(fleetTimeout) && fleetTimeout > 10_000 ? fleetTimeout : 120_000
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.warn({ err, subId: params.sub.id }, "OpenAI-compat fleet sub-agent call failed");
    // Return null so the fleet can fall back to OpenClaw; caller attaches detail to events/appendix.
    throw new Error(detail);
  }
}

async function runSubViaOpenClaw(params: {
  missionId: string;
  motherPrompt: string;
  profile: SpecialistAgentProfile;
  sub: { id: string; role: string; focus: string };
  priorOutputs: string;
  browserContext?: string;
}): Promise<string | null> {
  if (process.env.OPENCLAW_ORCHESTRATION === "0") return null;

  const sessionId =
    process.env.OPENCLAW_SESSION_PREFIX != null
      ? `${process.env.OPENCLAW_SESSION_PREFIX}-${params.missionId}-${params.sub.id}`
      : `recursive-agent-${params.missionId}-${params.sub.id}`;

  const message = [
    `You are sub-agent ${params.sub.id} with role ${params.sub.role}.`,
    `Focus: ${params.sub.focus}`,
    "",
    "## User mission",
    params.motherPrompt.trim(),
    "",
    "## Lead specialist context",
    params.profile.purpose,
    "",
    params.browserContext ? `## Browser/extract context\n${params.browserContext.trim()}\n` : "",
    "## Prior sub-agent outputs",
    params.priorOutputs.trim() || "(none)",
    "",
    "Respond with Markdown only: your deliverable for this role (no meta commentary about OpenClaw)."
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
    `# Fleet report → Mother agent`,
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
            "You are the mother agent synthesizing a fleet. Merge sub-agent outputs into one executive report: goals, decisions, risks, open questions, and ordered next steps. Markdown. Match user language (e.g. Indonesian if mission is Indonesian). Do not invent tool executions."
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
 * Runs each `profile.subAgents` entry **sequentially** (context carries forward), then builds a **merged report** for the mother.
 * Prefers OpenAI-compatible gateway when configured; otherwise attempts one OpenClaw CLI call per sub-agent.
 */
export async function runSubAgentFleet(params: {
  missionId: string;
  motherPrompt: string;
  profile: SpecialistAgentProfile;
  browserContext?: string;
  onProgress?: (label: string) => void;
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
    params.onProgress?.(`Sub-agent · ${sub.role}`);
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
          browserContext: params.browserContext
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
        browserContext: params.browserContext
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
        `# Mother agent — synthesized fleet report`,
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
