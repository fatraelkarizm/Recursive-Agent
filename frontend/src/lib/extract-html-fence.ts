/**
 * Pull first ```html ... ``` fence from Markdown (README) for live preview.
 */
export function extractFirstHtmlFence(markdown: string): string | null {
  if (!markdown?.trim()) return null;
  const m = markdown.match(/```html\s*([\s\S]*?)```/i);
  const inner = m?.[1]?.trim();
  return inner && inner.length > 0 ? inner : null;
}

/** Prefer frontend specialist README that contains ```html for live preview. */
export function findReadmeWithHtmlFence(
  specialists: { readmeMd?: string; canvasLane?: string }[]
): string {
  const frontend = specialists.filter((s) => s.canvasLane === "frontend");
  const ordered = [...frontend, ...specialists];
  for (const s of ordered) {
    if (s.readmeMd && extractFirstHtmlFence(s.readmeMd)) return s.readmeMd;
  }
  return specialists[0]?.readmeMd ?? "";
}
