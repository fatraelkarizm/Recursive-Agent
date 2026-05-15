const URL_RE = /https?:\/\/[^\s<>"')\]`]+/gi;

/** Unique http(s) URLs from plain text / markdown (best-effort, capped). */
export function extractHttpUrlsFromText(text: string, limit = 32): string[] {
  if (!text?.trim()) return [];
  const raw = text.match(URL_RE) ?? [];
  const cleaned = raw.map((u) => u.replace(/[),.;]+$/g, ""));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of cleaned) {
    if (!u.startsWith("http")) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= limit) break;
  }
  return out;
}
