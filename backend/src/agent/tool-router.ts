export async function runToolRoute(prompt: string): Promise<string> {
  if (prompt.toLowerCase().includes("research")) {
    return "Tavily mock route selected";
  }
  return "Internal fallback route selected";
}
