import { tavily } from "@tavily/core";

export type TavilyExtractOk = {
  ok: true;
  url: string;
  title: string | null;
  markdown: string;
  credits?: number;
};

export type TavilyExtractErr = {
  ok: false;
  error: string;
};

/**
 * One-off Tavily Extract for dashboard "Services" (docs/news preview).
 * Independent of `BROWSER_AUTOMATION` — only needs `TAVILY_API_KEY`.
 */
export async function tavilyExtractOne(params: {
  url: string;
  query?: string;
}): Promise<TavilyExtractOk | TavilyExtractErr> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "TAVILY_API_KEY tidak di-set di backend/.env" };
  }

  const url = params.url.trim();
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: "URL harus diawali http:// atau https://" };
  }

  const client = tavily({ apiKey });
  const q = (params.query ?? "").trim().slice(0, 500);

  try {
    const res = await client.extract([url], {
      format: "markdown",
      extractDepth: "basic",
      query: q || undefined,
      includeUsage: true
    });

    const failed = res.failedResults.find((f) => f.url === url);
    if (failed) {
      return { ok: false, error: failed.error };
    }

    const page = res.results[0];
    if (!page) {
      return { ok: false, error: "Tidak ada hasil extract" };
    }

    const markdown = (page.rawContent ?? "").trim() || "(konten kosong)";
    return {
      ok: true,
      url,
      title: page.title ?? null,
      markdown: markdown.length > 24000 ? `${markdown.slice(0, 23997)}…` : markdown,
      credits: res.usage?.credits
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
