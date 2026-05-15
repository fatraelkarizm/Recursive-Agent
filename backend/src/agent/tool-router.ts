import { tavily } from "@tavily/core";

export async function runToolRoute(prompt: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY?.trim();
  const p = prompt.toLowerCase();

  if (!key) {
    return "Tool route: no TAVILY_API_KEY — set it for Tavily search/extract.";
  }

  const client = tavily({ apiKey: key });

  if (p.includes("research") || p.includes("tavily") || p.includes("search the web") || p.includes("look up online")) {
    try {
      const q = prompt.trim().slice(0, 500);
      const res = await client.search(q, {
        maxResults: 4,
        searchDepth: "basic",
        includeAnswer: true
      });
      const lines = res.results.map((r) => `- **${r.title}** (${r.url}): ${r.content.slice(0, 220)}…`);
      const head = res.answer ? `Answer: ${res.answer}\n\n` : "";
      return `Tavily search:\n${head}${lines.join("\n")}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return `Tavily search failed: ${msg}`;
    }
  }

  return "Internal fallback route selected (no research-style keywords).";
}
