import type { SpecialistAgentProfile } from "../types";
import { isOpenAiCompatConfigured, openAiCompatibleChatCompletion } from "../compat/openai-compatible-chat";
import { buildFallbackHtmlDeliverable } from "./html-fallback";
import { stripMarkdownToPlainText } from "../util/plain-text";
import { logger } from "../logging";

export function missionWantsHtmlDeliverable(prompt: string): boolean {
  return /(landing\s*page|landing|halaman|one-?page|html|css|website|situs\s*web|web\s*page|homepage|hero\s*section|crypto)/i.test(
    prompt
  );
}

export function readmeHasHtmlFence(md: string): boolean {
  return /```html[\s\S]*?```/i.test(md);
}

export function readmeHasFallbackHtml(md: string): boolean {
  return /fallback HTML|Central fallback|Mother fallback|gateway LLM timeout\/abort/i.test(md);
}

export function stripDeliverableHtmlSections(md: string): string {
  return md
    .replace(/\n---\n+\n## Deliverable HTML[\s\S]*?(?=\n## |\n---\n## |$)/gi, "")
    .trim();
}

function motherLlmTimeoutMs(): number {
  const n = Number(process.env.MOTHER_LLM_TIMEOUT_MS ?? "180000");
  return Number.isFinite(n) && n > 10_000 ? n : 180_000;
}

function allowHtmlFallback(): boolean {
  return process.env.HTML_DELIVERABLE_FALLBACK === "1";
}

function normalizeHtmlBlock(raw: string): string | null {
  const t = raw.trim();
  if (readmeHasHtmlFence(t)) return t;
  if (/<!DOCTYPE\s+html/i.test(t) || /<html[\s>]/i.test(t)) {
    return ["```html", t.replace(/^```html\s*/i, "").replace(/```\s*$/i, ""), "```"].join("\n");
  }
  return null;
}

async function generateHtmlBlock(
  missionPrompt: string,
  profile: SpecialistAgentProfile,
  options?: { revisionNotes?: string; webResearch?: string }
): Promise<string> {
  const researchBlock = options?.webResearch?.trim()
    ? `\n\n## Web research (use for copy & visual direction)\n${options.webResearch.slice(0, 6000)}`
    : "";
  const revisionBlock = options?.revisionNotes
    ? `\n\nCentral Agent revision instructions:\n${options.revisionNotes.slice(0, 2000)}`
    : "";

  const primary = process.env.OPENAI_COMPAT_MODEL?.trim() || "qwen3.6-plus";
  const fallback = process.env.OPENAI_COMPAT_FALLBACK_MODEL?.trim() || "gemini/gemini-2.5-flash";
  const models = [...new Set([primary, fallback])];

  let lastErr: unknown;
  for (const model of models) {
    try {
      const raw = await openAiCompatibleChatCompletion({
        model,
        messages: [
          {
            role: "system",
            content: [
              "You generate deliverable code for a specialist README.",
              "Output Markdown containing exactly ONE fenced block: ```html ... ``` with a complete standalone HTML document.",
              "Include all CSS in <style> inside the document. Dark, elegant, responsive.",
              "Match the user mission topic EXACTLY (e.g. crypto landing page → crypto marketing copy).",
              "Never mention fallback, placeholder, or demo mode.",
              "No prose outside the fence."
            ].join(" ")
          },
          {
            role: "user",
            content: `Mission:\n${missionPrompt.slice(0, 4000)}${researchBlock}${revisionBlock}\n\nSpecialist: ${profile.name} (${profile.role})`
          }
        ],
        maxTokens: 3800,
        temperature: 0.55,
        timeoutMs: motherLlmTimeoutMs()
      });
      const normalized = normalizeHtmlBlock(raw);
      if (normalized) return normalized;
      lastErr = new Error("Model returned no ```html fence");
    } catch (err) {
      lastErr = err;
      logger.warn({ err, model, specialist: profile.name }, "HTML deliverable attempt failed");
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function appendHtmlToReadme(
  profile: SpecialistAgentProfile,
  block: string,
  options?: { force?: boolean; rework?: boolean }
): void {
  if (options?.force) {
    profile.readmeMd = stripDeliverableHtmlSections(profile.readmeMd);
  }
  const htmlFence = block.match(/```html[\s\S]*?```/i)?.[0] ?? `\`\`\`html\n${block.trim()}\n\`\`\``;
  profile.readmeMd += ["", "Deliverable HTML", "", htmlFence, ""].join("\n");
  profile.readmeMd = stripMarkdownToPlainText(
    profile.readmeMd.replace(/(```html[\s\S]*?```)/gi, (_, fence: string) => fence)
  );
}

/** When the user asked for a page/landing but README has no HTML fence, Central Agent adds one via LLM (topic-specific). */
export async function ensureLeadHtmlDeliverable(
  profile: SpecialistAgentProfile,
  missionPrompt: string,
  options?: { revisionNotes?: string; force?: boolean; webResearch?: string }
): Promise<boolean> {
  const wantsHtml = missionWantsHtmlDeliverable(missionPrompt) || Boolean(options?.revisionNotes);
  const hasHtml = readmeHasHtmlFence(profile.readmeMd) && !readmeHasFallbackHtml(profile.readmeMd);
  if (!wantsHtml || (hasHtml && !options?.force)) {
    return false;
  }

  if (options?.force || readmeHasFallbackHtml(profile.readmeMd)) {
    profile.readmeMd = stripDeliverableHtmlSections(profile.readmeMd);
  }

  if (!isOpenAiCompatConfigured()) {
    if (allowHtmlFallback()) {
      appendHtmlToReadme(profile, buildFallbackHtmlDeliverable(missionPrompt), { force: true });
      return true;
    }
    return false;
  }

  try {
    const block = await generateHtmlBlock(missionPrompt, profile, options);
    appendHtmlToReadme(profile, block, { force: options?.force, rework: options?.force });
    return true;
  } catch (err) {
    logger.error({ err, specialist: profile.name }, "ensureLeadHtmlDeliverable failed — no fallback unless HTML_DELIVERABLE_FALLBACK=1");
    if (allowHtmlFallback()) {
      appendHtmlToReadme(profile, buildFallbackHtmlDeliverable(missionPrompt), { force: true });
      return true;
    }
    return false;
  }
}

/** HTML preview lives on the frontend specialist README (or lead if solo). */
export async function ensureSquadHtmlDeliverables(
  squad: SpecialistAgentProfile[],
  missionPrompt: string,
  options?: { revisionNotes?: string; force?: boolean; webResearch?: string }
): Promise<number> {
  const frontend = squad.filter((s) => s.canvasLane === "frontend");
  const targets = frontend.length > 0 ? frontend : squad.slice(0, 1);
  let added = 0;
  for (const agent of targets) {
    const ok = await ensureLeadHtmlDeliverable(agent, missionPrompt, options);
    if (ok) added++;
  }
  return added;
}
