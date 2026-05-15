import { tavily } from "@tavily/core";
import { logger } from "../logging";

/**
 * Mother always runs a Tavily search first so squad design and deliverables
 * are grounded in current web context.
 */
export async function runMotherWebResearch(missionPrompt: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) {
    return "_TAVILY_API_KEY belum di-set di `backend/.env` — Mother melewati riset web._";
  }

  const client = tavily({ apiKey: key });
  const q = missionPrompt.trim().slice(0, 500);

  try {
    const res = await client.search(q, {
      maxResults: 5,
      searchDepth: "advanced",
      includeAnswer: true
    });

    const lines = res.results.map(
      (r) => `- **${r.title}** (${r.url}): ${(r.content ?? "").slice(0, 280)}…`
    );
    const head = res.answer ? `**Ringkasan Tavily:** ${res.answer}\n\n` : "";
    return `${head}**Sumber (${lines.length}):**\n${lines.join("\n")}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, "Mother web research failed");
    return `_Riset web gagal: ${msg.slice(0, 240)}_`;
  }
}
