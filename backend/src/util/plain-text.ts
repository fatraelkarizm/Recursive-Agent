/** Plain text only: no asterisks, backticks, headings markup. Preserves ```html fences for live preview. */
export function stripMarkdownToPlainText(input: string): string {
  const htmlBlocks: string[] = [];
  let t = input;

  t = t.replace(/```html[\s\S]*?```/gi, (m) => {
    htmlBlocks.push(m);
    return `\n__HTML_BLOCK_${htmlBlocks.length - 1}__\n`;
  });

  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/\*([^*]+)\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1");
  t = t.replace(/_([^_]+)_/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/^>\s?/gm, "");
  t = t.replace(/^\s*[-*+]\s+/gm, "");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  t = t.replace(/^---+$/gm, "");
  t = t.replace(/\n{3,}/g, "\n\n");

  htmlBlocks.forEach((block, i) => {
    t = t.replace(`__HTML_BLOCK_${i}__`, block);
  });

  return t.trim();
}
