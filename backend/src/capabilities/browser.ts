import { tavily } from "@tavily/core";
import { extractFirstUrl } from "../agent/specializations";

/**
 * Web read for the specialist via **Tavily Extract** (no local headless browser).
 * Set `TAVILY_API_KEY` in backend `.env`. Disable with `BROWSER_AUTOMATION=0`.
 */
export async function browserTouchFromPrompt(prompt: string): Promise<string> {
  if (process.env.BROWSER_AUTOMATION === "0") {
    return "Tavily web read disabled (BROWSER_AUTOMATION=0).";
  }

  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    return "tavily-browser: missing TAVILY_API_KEY — add it to backend/.env for Extract on the mission URL.";
  }

  const url = extractFirstUrl(prompt) ?? process.env.BROWSER_DEFAULT_URL ?? "https://example.com";
  const client = tavily({ apiKey });

  try {
    const res = await client.extract([url], {
      format: "markdown",
      extractDepth: "basic",
      query: prompt.slice(0, 400),
      includeUsage: true
    });

    const failed = res.failedResults.find((f) => f.url === url);
    if (failed) {
      return `tavily-browser: extract failed for ${url} — ${failed.error}`;
    }

    const page = res.results[0];
    if (!page) {
      return `tavily-browser: no result for ${url}`;
    }

    const snippet = page.rawContent.replace(/\s+/g, " ").trim().slice(0, 1200);
    const credits = res.usage?.credits != null ? ` [usage ~${res.usage.credits} credits]` : "";

    return [
      `tavily-browser: ${url}`,
      `title: ${page.title ?? "(none)"}${credits}`,
      "---",
      snippet || "(empty body)"
    ].join("\n");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `tavily-browser: request error — ${msg}`;
  }
}
