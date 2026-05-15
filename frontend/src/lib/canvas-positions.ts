const STORAGE_KEY = "recursive-agent-canvas-positions-v1";

export type CanvasPosition = { x: number; y: number };

export function loadAllCanvasPositions(): Record<string, CanvasPosition> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CanvasPosition>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadCanvasPosition(nodeId: string): CanvasPosition | null {
  const all = loadAllCanvasPositions();
  const p = all[nodeId];
  if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
  return null;
}

export function saveCanvasPosition(nodeId: string, position: CanvasPosition): void {
  if (typeof window === "undefined") return;
  const all = loadAllCanvasPositions();
  all[nodeId] = position;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
