import { nanoid } from "nanoid";
import { z } from "zod";
import type { MissionPayload, SpecialistAgentProfile, SubAgentDescriptor } from "../types";
import { isOpenAiCompatConfigured, openAiCompatibleChatCompletion } from "../compat/openai-compatible-chat";
import { buildEffectiveMissionPrompt } from "./mission-prompt";
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

const specialistSchema = z.object({
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
  readmeMd: z.string().min(1)
});

const planSchema = z.object({
  motherBrief: z.string().min(1),
  specialists: z.array(specialistSchema).min(1).max(4)
});

export type MotherSquadPlan = z.infer<typeof planSchema>;

function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeSubAgents(subs: z.infer<typeof subAgentSchema>[] | undefined, role: string): SubAgentDescriptor[] | undefined {
  if (!subs?.length) return undefined;
  return subs.map((s) => ({
    id: `sub-${nanoid(6)}`,
    role: s.role.includes("-") ? s.role : `${role}-${s.role}`,
    focus: s.focus
  }));
}

function toProfile(s: z.infer<typeof specialistSchema>): SpecialistAgentProfile {
  const allowedTools = s.allowedTools?.length
    ? s.allowedTools
    : ["tavily-search", "internal-mission-log"];
  return {
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
    readmeMd: s.readmeMd,
    canvasLane: s.canvasLane ?? "general"
  };
}

/**
 * Mother agent designs the specialist squad via LLM (not rule-based templates).
 * Falls back to legacy inference only when the gateway is unavailable or JSON is invalid.
 */
export async function synthesizeSquadFromMother(payload: MissionPayload): Promise<{
  squad: SpecialistAgentProfile[];
  motherBrief: string;
  source: "mother-llm" | "fallback-rules";
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

  const system = [
    "You are the Mother Agent of Recursive Agent — a mission control orchestrator.",
    "Design a small squad of specialist agents for ONE user mission. Think from first principles; do NOT use fixed templates.",
    "Return ONLY valid JSON (no markdown outside the JSON) matching this shape:",
    "{",
    '  "motherBrief": "2-4 sentences in Indonesian: reasoning, decomposition, risks",',
    '  "specialists": [{',
    '    "name": "kebab-case-id",',
    '    "role": "short-role-id",',
    '    "purpose": "one sentence",',
    '    "systemInstructions": "actionable system prompt for this specialist",',
    '    "canvasLane": "frontend|backend|general",',
    '    "specializations": ["core-mission", ...],',
    '    "orchestrationMode": "local|openclaw",',
    '    "allowedTools": ["tavily-search", "tavily-extract", ...],',
    '    "subAgents": [{ "role": "scout|worker|reviewer|custom", "focus": "what this leg does" }],',
    '    "skills": [{ "id": "...", "label": "...", "description": "...", "kind": "touch|generate|orchestrate|other" }],',
    '    "readmeMd": "Full README in Markdown. If user wants a landing/page/HTML: include ONE complete ```html fenced block (embedded CSS, dark elegant) tailored to the EXACT topic (e.g. crypto landing → crypto hero, features, CTA — NOT a generic article/CMS editor)."',
    "  }]",
    "}",
    "Rules:",
    "- Infer deliverable type from the user prompt (landing page vs CMS vs API-only). Never default to article/CMS templates.",
    "- Single-page landing / marketing HTML → usually 1 specialist with html fence; do NOT split frontend+backend unless user asked for full stack.",
    "- 2 specialists only when UI and API/data are clearly separate deliverables.",
    "- subAgents: 0-3 on lead specialist only when critique helps; omit for simple one-page builds.",
    "- readmeMd must be substantive and topic-specific. Honor user language (Indonesian if user writes Indonesian).",
    "- Do not invent API keys or claim tools ran."
  ].join("\n");

  try {
    const raw = await openAiCompatibleChatCompletion({
      messages: [
        { role: "system", content: system },
        { role: "user", content: effectivePrompt }
      ],
      maxTokens: 4500,
      temperature: 0.55
    });

    const parsed = planSchema.parse(extractJsonObject(raw));
    const squad = parsed.specialists.map(toProfile);
    return { squad, motherBrief: parsed.motherBrief.trim(), source: "mother-llm" };
  } catch (err) {
    logger.warn({ err }, "Mother squad synthesis failed — using rule fallback");
    const squad = inferSpecialistSquad(effectivePrompt);
    return {
      squad,
      motherBrief:
        "_Mother tidak bisa mem-parse rencana LLM; squad sementara dari fallback aturan. Periksa model/gateway dan coba lagi._",
      source: "fallback-rules"
    };
  }
}
