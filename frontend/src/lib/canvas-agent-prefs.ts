const HIDDEN_KEY = "recursive-agent-hidden-ids-v1";
const VIEW_KEY = "recursive-agent-canvas-view-v1";

export type CanvasViewMode = "all" | "latest-mission";

export function loadHiddenAgentIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function saveHiddenAgentIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids]));
}

export function loadCanvasViewMode(): CanvasViewMode {
  if (typeof window === "undefined") return "latest-mission";
  const v = localStorage.getItem(VIEW_KEY);
  return v === "all" ? "all" : "latest-mission";
}

export function saveCanvasViewMode(mode: CanvasViewMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VIEW_KEY, mode);
}
