import type { SpecialistAgentProfile } from "../types";
import { isOpenAiCompatConfigured, openAiCompatibleChatCompletion } from "../compat/openai-compatible-chat";
import { logger } from "../logging";

export function missionWantsHtmlDeliverable(prompt: string): boolean {
  return /(landing\s*page|landing|halaman|one-?page|html|css|website|situs\s*web|web\s*page|homepage|hero\s*section)/i.test(
    prompt
  );
}

export function readmeHasHtmlFence(md: string): boolean {
  return /```html[\s\S]*?```/i.test(md);
}

/** When the user asked for a page/landing but README has no HTML fence, Mother adds one via LLM (topic-specific). */
export async function ensureLeadHtmlDeliverable(
  profile: SpecialistAgentProfile,
  missionPrompt: string
): Promise<boolean> {
  if (!missionWantsHtmlDeliverable(missionPrompt) || readmeHasHtmlFence(profile.readmeMd)) {
    return false;
  }
  if (!isOpenAiCompatConfigured()) return false;

  try {
    const block = await openAiCompatibleChatCompletion({
      messages: [
        {
          role: "system",
          content: [
            "You generate deliverable code for a specialist README.",
            "Output Markdown containing exactly ONE fenced block: ```html ... ``` with a complete standalone HTML document.",
            "Include all CSS in <style> inside the document. Dark, elegant, responsive.",
            "Match the user mission topic EXACTLY (e.g. crypto landing page → crypto marketing copy, not a generic article CMS).",
            "Do NOT output article/CMS editor layouts unless the user explicitly asked for CMS or blog editor.",
            "No prose outside the fence."
          ].join(" ")
        },
        {
          role: "user",
          content: `Mission:\n${missionPrompt.slice(0, 4000)}\n\nSpecialist: ${profile.name} (${profile.role})`
        }
      ],
      maxTokens: 3800,
      temperature: 0.5
    });

    profile.readmeMd += [
      "",
      "---",
      "",
      "## Deliverable HTML (Mother-generated)",
      "",
      block.trim(),
      ""
    ].join("\n");
    return true;
  } catch (err) {
    logger.warn({ err, specialist: profile.name }, "ensureLeadHtmlDeliverable failed");
    return false;
  }
}
