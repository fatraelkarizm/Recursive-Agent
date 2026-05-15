import type { SpecialistAgentProfile } from "../types";
import { isOpenAiCompatConfigured, openAiCompatibleChatCompletion } from "../compat/openai-compatible-chat";
import { buildFallbackHtmlDeliverable } from "./html-fallback";
import { logger } from "../logging";

export function missionWantsHtmlDeliverable(prompt: string): boolean {
  return /(landing\s*page|landing|halaman|one-?page|html|css|website|situs\s*web|web\s*page|homepage|hero\s*section|crypto)/i.test(
    prompt
  );
}

export function readmeHasHtmlFence(md: string): boolean {
  return /```html[\s\S]*?```/i.test(md);
}

function motherLlmTimeoutMs(): number {
  const n = Number(process.env.MOTHER_LLM_TIMEOUT_MS ?? "120000");
  return Number.isFinite(n) && n > 10_000 ? n : 120_000;
}

function isAbortError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /aborted|abort/i.test(msg);
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
    ? `\n\nMother revision instructions:\n${options.revisionNotes.slice(0, 2000)}`
    : "";

  return openAiCompatibleChatCompletion({
    messages: [
      {
        role: "system",
        content: [
          "You generate deliverable code for a specialist README.",
          "Output Markdown containing exactly ONE fenced block: ```html ... ``` with a complete standalone HTML document.",
          "Include all CSS in <style> inside the document. Dark, elegant, responsive.",
          "Match the user mission topic EXACTLY (e.g. crypto landing page → crypto marketing copy).",
          "Do NOT output article/CMS editor layouts unless the user explicitly asked for CMS.",
          "No prose outside the fence."
        ].join(" ")
      },
      {
        role: "user",
        content: `Mission:\n${missionPrompt.slice(0, 4000)}${researchBlock}${revisionBlock}\n\nSpecialist: ${profile.name} (${profile.role})`
      }
    ],
    maxTokens: 3800,
    temperature: 0.5,
    timeoutMs: motherLlmTimeoutMs()
  });
}

function appendHtmlToReadme(
  profile: SpecialistAgentProfile,
  block: string,
  options?: { force?: boolean; rework?: boolean }
): void {
  if (options?.force) {
    profile.readmeMd = profile.readmeMd.replace(
      /\n---\n+\n## Deliverable HTML[\s\S]*?(?=\n## |\n---\n## |$)/i,
      ""
    );
  }
  profile.readmeMd += [
    "",
    "---",
    "",
    options?.rework ? "## Deliverable HTML (Mother rework)" : "## Deliverable HTML (Mother-generated)",
    "",
    block.trim(),
    ""
  ].join("\n");
}

/** When the user asked for a page/landing but README has no HTML fence, Mother adds one via LLM (topic-specific). */
export async function ensureLeadHtmlDeliverable(
  profile: SpecialistAgentProfile,
  missionPrompt: string,
  options?: { revisionNotes?: string; force?: boolean; webResearch?: string }
): Promise<boolean> {
  const wantsHtml = missionWantsHtmlDeliverable(missionPrompt) || Boolean(options?.revisionNotes);
  const hasHtml = readmeHasHtmlFence(profile.readmeMd);
  if (!wantsHtml || (hasHtml && !options?.force)) {
    return false;
  }

  if (!isOpenAiCompatConfigured()) {
    appendHtmlToReadme(profile, buildFallbackHtmlDeliverable(missionPrompt), {
      force: options?.force
    });
    return true;
  }

  let block: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      block = await generateHtmlBlock(missionPrompt, profile, options);
      break;
    } catch (err) {
      if (attempt === 0 && isAbortError(err)) {
        logger.warn({ err, specialist: profile.name }, "HTML deliverable aborted — retrying once");
        continue;
      }
      logger.warn({ err, specialist: profile.name }, "ensureLeadHtmlDeliverable failed");
      break;
    }
  }

  if (block && readmeHasHtmlFence(block)) {
    appendHtmlToReadme(profile, block, { force: options?.force, rework: options?.force });
    return true;
  }

  appendHtmlToReadme(profile, buildFallbackHtmlDeliverable(missionPrompt), { force: options?.force });
  return true;
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
