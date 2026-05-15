import type { Node } from "@xyflow/react";

type Rect = { x: number; y: number; w: number; h: number };

const BOUNDS: Record<string, { w: number; h: number }> = {
  specialist: { w: 232, h: 80 },
  subAgent: { w: 188, h: 68 },
  mother: { w: 268, h: 108 },
  trigger: { w: 168, h: 52 },
  branch: { w: 168, h: 52 },
  action: { w: 208, h: 60 },
  knowledge: { w: 260, h: 140 },
  default: { w: 200, h: 56 }
};

const STATIC_IDS = new Set(["trigger", "mother", "branch", "tool-heavy", "knowledge"]);

function boundsFor(node: Node): Rect {
  const b = BOUNDS[node.type ?? "default"] ?? BOUNDS.default;
  return { x: node.position.x, y: node.position.y, w: b.w, h: b.h };
}

function overlaps(a: Rect, b: Rect, pad = 20): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

function findFreePosition(
  desired: { x: number; y: number },
  obstacles: Rect[],
  size: { w: number; h: number }
): { x: number; y: number } {
  for (let i = 0; i < 96; i++) {
    const angle = i * 0.62;
    const radius = 24 + i * 14;
    const pos = {
      x: Math.round(desired.x + Math.cos(angle) * radius),
      y: Math.round(desired.y + Math.sin(angle) * radius)
    };
    const r: Rect = { ...pos, ...size };
    if (!obstacles.some((o) => overlaps(r, o))) return pos;
  }
  return {
    x: Math.round(desired.x + 120),
    y: Math.round(desired.y + 80)
  };
}

/**
 * Push specialist/sub nodes away from static workflow nodes and each other.
 * Nodes that already existed (in `stableIds`) keep their position; only new nodes get resolved.
 */
export function resolveNodeCollisions(nodes: Node[], stableIds?: Set<string>): Node[] {
  const placed: Rect[] = [];
  const out = nodes.map((n) => ({ ...n, position: { ...n.position } }));

  for (const node of out) {
    if (STATIC_IDS.has(node.id)) {
      placed.push(boundsFor(node));
    }
  }

  for (const node of out) {
    if (STATIC_IDS.has(node.id)) continue;
    const size = BOUNDS[node.type ?? "default"] ?? BOUNDS.default;

    if (stableIds?.has(node.id)) {
      placed.push({ x: node.position.x, y: node.position.y, ...size });
      continue;
    }

    const free = findFreePosition(node.position, placed, size);
    node.position = free;
    placed.push({ x: free.x, y: free.y, ...size });
  }

  return out;
}
