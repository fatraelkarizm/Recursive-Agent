/**
 * Pull first ```html ... ``` fence from Markdown (README) for live preview.
 */
export function extractFirstHtmlFence(markdown: string): string | null {
  if (!markdown?.trim()) return null;
  const m = markdown.match(/```html\s*([\s\S]*?)```/i);
  const inner = m?.[1]?.trim();
  return inner && inner.length > 0 ? inner : null;
}
