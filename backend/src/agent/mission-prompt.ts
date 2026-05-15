import type { MissionPayload } from "../types";

/** Merge user prompt + optional context + URLs for squad, fleet, tools, and persistence. */
export function buildEffectiveMissionPrompt(payload: MissionPayload): string {
  const base = payload.prompt.trim();
  const chunks: string[] = [base];

  const notes = payload.contextNotes?.trim();
  if (notes) {
    chunks.push("", "## Konteks / pengetahuan (dari user)", notes);
  }

  const urls = (payload.referenceUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, 16);
  if (urls.length) {
    chunks.push("", "## URL referensi (prioritas extract & riset)", ...urls.map((u) => `- ${u}`));
  }

  if (payload.preferTavilySearch) {
    chunks.push("", "_Flag user: jalankan Tavily web search pada tool route meski prompt ringkas._");
  }

  const review = payload.motherReviewNotes?.trim();
  if (review) {
    chunks.push("", "## Review / uji dari user (putaran berikutnya)", review);
  }

  return chunks.join("\n");
}
