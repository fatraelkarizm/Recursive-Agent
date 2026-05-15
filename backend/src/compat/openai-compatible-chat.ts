/**
 * Optional OpenAI-compatible Chat Completions (SumoPod, LiteLLM, vLLM, etc.).
 * Env: OPENAI_COMPAT_BASE_URL (e.g. https://ai.sumopod.com/v1), bearer key, model id.
 */

import type { SpecialistAgentProfile } from "../types";
import { logger } from "../logging";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function isDeepseekUpstreamExhausted(status: number, raw: string): boolean {
  if (status !== 402) return false;
  const s = raw.toLowerCase();
  return s.includes("insufficient balance") || s.includes("deepseekexception");
}

function resolveFallbackModel(primary: string): string | null {
  const explicit = process.env.OPENAI_COMPAT_FALLBACK_MODEL?.trim();
  if (explicit) return explicit;
  // SumoPod: DeepSeek route can 402 while Gemini still works on the same API key / credit.
  if (primary.toLowerCase().includes("deepseek")) {
    return "gemini/gemini-2.5-flash";
  }
  return null;
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export function isOpenAiCompatConfigured(): boolean {
  const base = process.env.OPENAI_COMPAT_BASE_URL?.trim();
  const key = (process.env.OPENAI_COMPAT_API_KEY ?? process.env.DEEPSEEK_API_KEY)?.trim();
  return Boolean(base && key);
}

/**
 * POST /v1/chat/completions — same contract as OpenAI / SumoPod curl examples.
 */
async function chatCompletionOnce(params: {
  base: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}): Promise<{ ok: true; text: string } | { ok: false; status: number; raw: string }> {
  const url = joinUrl(params.base, "chat/completions");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        max_tokens: params.maxTokens,
        temperature: params.temperature
      })
    });

    const raw = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, raw };
    }

    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (data.error?.message) {
      return { ok: false, status: 500, raw: data.error.message };
    }

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, status: 500, raw: "Empty completion content" };
    }
    return { ok: true, text };
  } finally {
    clearTimeout(timer);
  }
}

export async function openAiCompatibleChatCompletion(params: {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Override default OPENAI_COMPAT_TIMEOUT_MS (Mother/long jobs need more). */
  timeoutMs?: number;
}): Promise<string> {
  const base = process.env.OPENAI_COMPAT_BASE_URL?.trim();
  const apiKey = (process.env.OPENAI_COMPAT_API_KEY ?? process.env.DEEPSEEK_API_KEY)?.trim();
  const model = process.env.OPENAI_COMPAT_MODEL?.trim() || "qwen3.6-plus";

  if (!base || !apiKey) {
    throw new Error("OPENAI_COMPAT_BASE_URL and a bearer key (OPENAI_COMPAT_API_KEY or DEEPSEEK_API_KEY) are required");
  }

  const timeoutMs =
    params.timeoutMs ??
    Number(process.env.OPENAI_COMPAT_TIMEOUT_MS ?? "45000");
  const maxTokens = params.maxTokens ?? 200;
  const temperature = params.temperature ?? 0.7;
  const request = {
    base,
    apiKey,
    messages: params.messages,
    maxTokens,
    temperature,
    timeoutMs
  };

  let result = await chatCompletionOnce({ ...request, model });
  if (result.ok) return result.text;

  const fallbackModel = resolveFallbackModel(model);
  if (fallbackModel && fallbackModel !== model && isDeepseekUpstreamExhausted(result.status, result.raw)) {
    logger.warn(
      { primary: model, fallback: fallbackModel },
      "OpenAI-compat primary model unavailable (upstream DeepSeek balance); retrying fallback model"
    );
    result = await chatCompletionOnce({ ...request, model: fallbackModel });
    if (result.ok) return result.text;
  }

  throw new Error(`HTTP ${result.status}: ${result.raw.slice(0, 500)}`);
}

/** One short assistant paragraph to append to specialist README when compat is enabled. */
export async function sumopodReadmeAddendum(missionPrompt: string, specialistName: string): Promise<string | null> {
  if (!isOpenAiCompatConfigured()) return null;

  try {
    return await openAiCompatibleChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You help document a specialist AI agent. Reply in Markdown, max ~120 words, Indonesian if the user prompt is Indonesian. No preamble."
        },
        {
          role: "user",
          content: `Specialist name: ${specialistName}\nUser mission:\n${missionPrompt.slice(0, 2000)}\n\nWrite a short "Getting started" blurb for this specialist's README.`
        }
      ],
      maxTokens: 220,
      temperature: 0.6
    });
  } catch {
    return null;
  }
}

/** Append SumoPod / OpenAI-compat blurb to specialist README when env is set. */
export async function enrichProfileReadmeWithSumopod(
  profile: SpecialistAgentProfile,
  missionPrompt: string
): Promise<void> {
  if (!isOpenAiCompatConfigured()) return;

  const addendum = await sumopodReadmeAddendum(missionPrompt, profile.name);
  if (!addendum) return;

  profile.readmeMd += [
    "",
    "---",
    "",
    "## Saran dari gateway OpenAI-compatible (mis. SumoPod)",
    "",
    addendum,
    ""
  ].join("\n");

  if (!profile.allowedTools.includes("sumopod-chat-completions")) {
    profile.allowedTools.push("sumopod-chat-completions");
  }
  if (!profile.apiKeyRefs.includes("OPENAI_COMPAT_BEARER")) {
    profile.apiKeyRefs.push("OPENAI_COMPAT_BEARER");
  }
}
