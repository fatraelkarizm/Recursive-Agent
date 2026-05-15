import { nanoid } from "nanoid";
import { z } from "zod";
import type { MissionPayload, SpecialistAgentProfile, SubAgentDescriptor } from "../types";
import { isOpenAiCompatConfigured, openAiCompatibleChatCompletion } from "../compat/openai-compatible-chat";
import { buildEffectiveMissionPrompt } from "./mission-prompt";
import { attachSpecialistArtifacts } from "./specialist-artifacts";
import { inferSpecialistSquad } from "./squad-inference";
import { logger } from "../logging";

const skillSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(["touch", "generate", "orchestrate", "other"])
});

const subAgentSchema = z.object({
  role: z.string().min(1),
  focus: z.string().min(1)
});

/** Lite schema — no readmeMd in JSON (HTML/markdown breaks JSON.parse on many models). */
const specialistLiteSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  purpose: z.string().min(1),
  systemInstructions: z.string().min(1),
  canvasLane: z.enum(["frontend", "backend", "general"]).optional(),
  specializations: z.array(z.string()).default(["core-mission"]),
  orchestrationMode: z.enum(["local", "openclaw"]).default("local"),
  allowedTools: z.array(z.string()).optional(),
  subAgents: z.array(subAgentSchema).optional(),
  skills: z.array(skillSchema).default([]),
  readmeOutline: z.string().optional()
});

const planSchema = z.object({
  motherBrief: z.string().min(1),
  specialists: z.array(specialistLiteSchema).min(1).max(4)
});

export type MotherSquadPlan = z.infer<typeof planSchema>;

function repairJsonText(s: string): string {
  return s
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'");
}

function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = (fenced?.[1] ?? raw).trim();
  candidate = repairJsonText(candidate);

  const start = candidate.indexOf("{");
  if (start === -1) throw new Error("No JSON object in model output");

  // Brace-balanced slice (readmeMd with `}` used to break lastIndexOf)
  let depth = 0;
  let end = -1;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error("Unbalanced JSON braces in model output");

  const slice = candidate.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return JSON.parse(repairJsonText(slice));
  }
}

function normalizeSubAgents(subs: z.infer<typeof subAgentSchema>[] | undefined, role: string): SubAgentDescriptor[] | undefined {
  if (!subs?.length) return undefined;
  return subs.map((s) => ({
    id: `sub-${nanoid(6)}`,
    role: s.role.includes("-") ? s.role : `${role}-${s.role}`,
    focus: s.focus
  }));
}

function toProfile(s: z.infer<typeof specialistLiteSchema>, missionPrompt: string): SpecialistAgentProfile {
  const allowedTools = s.allowedTools?.length
    ? s.allowedTools
    : ["tavily-search", "internal-mission-log"];
  const profile: SpecialistAgentProfile = {
    name: s.name,
    role: s.role,
    purpose: s.purpose,
    systemInstructions: s.systemInstructions,
    allowedTools,
    outputFormat: "markdown",
    apiKeyRefs: ["OPENAI_COMPAT_BEARER", "TAVILY_API_KEY"],
    notes: "",
    specializations: s.specializations.length ? s.specializations : ["core-mission"],
    orchestrationMode: s.orchestrationMode,
    subAgents: normalizeSubAgents(s.subAgents, s.role),
    skills: s.skills.length
      ? s.skills
      : [
          {
            id: "generate-deliverable",
            label: "Generate output",
            description: "Menghasilkan deliverable sesuai misi.",
            kind: "generate"
          }
        ],
    readmeMd: "",
    canvasLane: s.canvasLane ?? "general"
  };

  attachSpecialistArtifacts(profile, missionPrompt);
  if (s.readmeOutline?.trim()) {
    profile.readmeMd += ["", "## Rencana Mother", "", s.readmeOutline.trim(), ""].join("\n");
    profile.skillMd =
      (profile.skillMd ?? "") +
      ["", "## Rencana Mother", "", s.readmeOutline.trim(), ""].join("\n");
  }
  return profile;
}

const SYSTEM_PROMPT = [
  "You are the Mother Agent of Recursive Agent — a mission control orchestrator.",
  "Design a small squad of specialist agents for ONE user mission. Think from first principles; do NOT use fixed templates.",
  "Return ONLY one valid JSON object. No markdown outside JSON. No code fences inside string values.",
  "Schema:",
  "{",
  '  "motherBrief": "2-4 sentences in Indonesian: reasoning, decomposition, risks",',
  '  "specialists": [{',
  '    "name": "kebab-case-id",',
  '    "role": "short-role-id",',
  '    "purpose": "one sentence",',
  '    "systemInstructions": "actionable system prompt",',
  '    "canvasLane": "frontend|backend|general",',
  '    "specializations": ["core-mission"],',
  '    "orchestrationMode": "local|openclaw",',
  '    "allowedTools": ["tavily-search"],',
  '    "subAgents": [{ "role": "scout", "focus": "..." }],',
  '    "skills": [{ "id": "x", "label": "y", "description": "z", "kind": "generate" }],',
  '    "readmeOutline": "bullet outline only — deliverable HTML will be generated in a later step"',
  "  }]",
  "}",
  "Rules:",
  "- Do NOT put readmeMd or ```html in JSON — it breaks parsing.",
  "- Landing page / crypto / HTML / UI → ALWAYS 2 specialists: canvasLane frontend + canvasLane backend, each with skills[] and readmeOutline.",
  "- Never use role general-specialist-agent for web/UI missions.",
  "- Never default to article/CMS unless user asked for CMS.",
  "- Match user language (Indonesian if user writes Indonesian)."
].join("\n");

function motherLlmTimeoutMs(): number {
  const n = Number(process.env.MOTHER_LLM_TIMEOUT_MS ?? "120000");
  return Number.isFinite(n) && n > 10_000 ? n : 120_000;
}

async function callMotherPlan(effectivePrompt: string, temperature: number): Promise<string> {
  return openAiCompatibleChatCompletion({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: effectivePrompt }
    ],
    maxTokens: 2800,
    temperature,
    timeoutMs: motherLlmTimeoutMs()
  });
}

/**
 * Mother agent designs the specialist squad via LLM (not rule-based templates).
 * Falls back to legacy inference only when the gateway is unavailable or JSON is invalid.
 */
export async function synthesizeSquadFromMother(payload: MissionPayload): Promise<{
  squad: SpecialistAgentProfile[];
  motherBrief: string;
  source: "mother-llm" | "fallback-rules";
  parseError?: string;
}> {
  const effectivePrompt = buildEffectiveMissionPrompt(payload);

  if (!isOpenAiCompatConfigured()) {
    const squad = inferSpecialistSquad(effectivePrompt);
    return {
      squad,
      motherBrief: "_Mother LLM tidak tersedia — squad dari aturan internal (fallback)._",
      source: "fallback-rules"
    };
  }

  const attempts: Array<{ temp: number; label: string }> = [
    { temp: 0.35, label: "primary" },
    { temp: 0.2, label: "retry-strict" }
  ];

  let lastError = "unknown";

  for (const attempt of attempts) {
    try {
      const raw = await callMotherPlan(effectivePrompt, attempt.temp);
      const parsed = planSchema.parse(extractJsonObject(raw));
      const squad = parsed.specialists.map((s) => toProfile(s, effectivePrompt));
      return { squad, motherBrief: parsed.motherBrief.trim(), source: "mother-llm" };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logger.warn({ err, attempt: attempt.label }, "Mother squad synthesis parse failed");
    }
  }

  const squad = inferSpecialistSquad(effectivePrompt);
  return {
    squad,
    motherBrief:
      "_Mother tidak bisa mem-parse rencana LLM; squad sementara dari fallback aturan. HTML akan tetap dicoba lewat langkah deliverable terpisah._",
    source: "fallback-rules",
    parseError: lastError.slice(0, 200)
  };
}
