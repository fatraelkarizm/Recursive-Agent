"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { saveCanvasAgentPosition } from "@/lib/api";
import { loadAllCanvasPositions, loadCanvasPosition, saveCanvasPosition } from "@/lib/canvas-positions";
import { resolveNodeCollisions } from "@/lib/canvas-layout";
import type { MissionProgressEvent } from "@/lib/types";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeTypes
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ActionNode,
  BranchNode,
  KnowledgeNode,
  MotherAgentNode,
  SpecialistAgentNode,
  SubAgentNode,
  TriggerNode
} from "@/components/workflow-nodes";
import type { SpecialistAgentProfile } from "@/lib/types";
import type { AgentDashboardTarget } from "@/components/agent-dashboard-modal";

const SUB_NODE_PREFIX = "sub-node-";
const SP_PREFIX = "specialist-sp-";

const nodeTypes = {
  trigger: TriggerNode,
  mother: MotherAgentNode,
  specialist: SpecialistAgentNode,
  subAgent: SubAgentNode,
  branch: BranchNode,
  action: ActionNode,
  knowledge: KnowledgeNode
} satisfies NodeTypes;

function agentNodeId(agent: SpecialistAgentProfile, index: number): string {
  return `${SP_PREFIX}${agent.persistedId ?? `idx-${index}`}`;
}

function resolveNodePosition(
  nodeId: string,
  agent: SpecialistAgentProfile | undefined,
  fallback: { x: number; y: number }
): { x: number; y: number } {
  const fromProfile = agent?.canvasPosition;
  if (fromProfile && Number.isFinite(fromProfile.x) && Number.isFinite(fromProfile.y)) {
    return fromProfile;
  }
  const fromStorage = loadCanvasPosition(nodeId);
  if (fromStorage) return fromStorage;
  return fallback;
}

function layoutAgentGrid(n: number): { x: number; y: number }[] {
  if (n <= 0) return [];
  const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(n))));
  const w = 232;
  const hGap = 36;
  const vGap = 88;
  const positions: { x: number; y: number }[] = [];

  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = Math.min(cols, n - row * cols);
    const rowW = inRow * w + (inRow - 1) * hGap;
    const rowX0 = 360 - rowW / 2;
    positions.push({
      x: Math.round(rowX0 + col * (w + hGap)),
      y: 300 + row * vGap
    });
  }
  return positions;
}

function inferSubAgentKind(role: string): "scout" | "worker" | "reviewer" {
  const r = role.toLowerCase();
  if (r.includes("scout")) return "scout";
  if (r.includes("reviewer")) return "reviewer";
  return "worker";
}

function layoutSubAgentPositions(count: number, leadCenterX: number): { x: number; y: number }[] {
  const y = 468;
  const card = 188;
  const gap = 22;
  const total = count * card + (count - 1) * gap;
  const x0 = leadCenterX - total / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: Math.round(x0 + i * (card + gap)),
    y
  }));
}

const STATIC_BASE_NODES: Node[] = [
  {
    id: "trigger",
    type: "trigger",
    position: { x: 20, y: 120 },
    data: { label: "On mission request" }
  },
  {
    id: "mother",
    type: "mother",
    position: { x: 260, y: 90 },
    data: { label: "Central Agent (tools)" }
  },
  {
    id: "branch",
    type: "branch",
    position: { x: 560, y: 130 },
    data: { label: "Route by policy" }
  },
  {
    id: "tool-heavy",
    type: "action",
    position: { x: 820, y: 40 },
    data: { label: "Tool-heavy path", sub: "invoke MCP / HTTP tools" }
  },
  {
    id: "knowledge",
    type: "knowledge",
    position: { x: 820, y: 200 },
    data: {
      label: "Knowledge Sources",
      sources: ["GitHub SKILL.md", "Tavily Search", "Tavily Extract", "Awesome Lists", "NPM Docs"],
      skillCount: 0,
      docCount: 0
    }
  }
];

const STATIC_BASE_EDGES: Edge[] = [
  { id: "e-trigger-mother", source: "trigger", target: "mother", animated: true },
  {
    id: "e-mother-branch",
    source: "mother",
    target: "branch",
    sourceHandle: "to-branch",
    animated: false
  },
  {
    id: "e-branch-tools",
    source: "branch",
    target: "tool-heavy",
    sourceHandle: "yes",
    label: "tools allowed",
    style: { stroke: "#4ADE80" }
  },
  {
    id: "e-branch-knowledge",
    source: "branch",
    target: "knowledge",
    sourceHandle: "no",
    label: "knowledge",
    style: { stroke: "#2DD4BF" }
  }
];

function cloneNodes(nodes: Node[]): Node[] {
  return nodes.map((n) => ({ ...n, data: { ...(n.data as object) }, position: { ...n.position } }));
}

function cloneEdges(edges: Edge[]): Edge[] {
  return edges.map((e) => ({ ...e, style: e.style ? { ...e.style } : undefined }));
}

function isPlaceholderProfile(profile: SpecialistAgentProfile): boolean {
  return profile.role === "pending" && profile.name === "Pending Agent";
}

type FlowSurfaceProps = {
  status: string;
  specialists: SpecialistAgentProfile[];
  activeMissionId?: string | null;
  onSelectAgent?: (target: AgentDashboardTarget) => void;
  onOpenMotherDashboard?: () => void;
  motherThinking?: boolean;
  motherProgressCurrent?: MissionProgressEvent | null;
  motherProgressHistory?: MissionProgressEvent[];
  knowledgeStats?: { skillCount: number; docCount: number } | null;
};

function FlowSurface({
  status,
  specialists,
  activeMissionId,
  onSelectAgent,
  onOpenMotherDashboard,
  motherThinking,
  motherProgressCurrent,
  motherProgressHistory,
  knowledgeStats
}: FlowSurfaceProps) {
  const savedStaticRef = useRef(loadAllCanvasPositions());
  const initialNodes = useMemo(() => {
    const saved = loadAllCanvasPositions();
    return cloneNodes(STATIC_BASE_NODES).map((n) => {
      const p = saved[n.id];
      return p ? { ...n, position: p } : n;
    });
  }, []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(cloneEdges(STATIC_BASE_EDGES));

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges]
  );

  const onNodeDragStop: NodeMouseHandler = useCallback(
    (_event, node) => {
      const pos = { x: node.position.x, y: node.position.y };
      saveCanvasPosition(node.id, pos);
      if (node.id.startsWith(SP_PREFIX)) {
        const agentId = node.id.slice(SP_PREFIX.length);
        if (agentId && !agentId.startsWith("idx-")) {
          void saveCanvasAgentPosition(agentId, pos).catch(() => {
            /* DB optional */
          });
        }
      }
    },
    []
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (!onSelectAgent) return;
      if (node.id.startsWith(SP_PREFIX)) {
        const agentId = node.id.slice(SP_PREFIX.length);
        onSelectAgent({ kind: "specialist", agentId });
        return;
      }
      if (node.id.startsWith(SUB_NODE_PREFIX)) {
        onSelectAgent({ kind: "sub", subId: node.id.slice(SUB_NODE_PREFIX.length) });
      }
    },
    [onSelectAgent]
  );

  useEffect(() => {
    const lead = specialists[0];
    const pending = isPlaceholderProfile(lead);

    let ring = "";
    if (status === "running") ring = "ring-2 ring-amber-300/60";
    else if (status === "failed") ring = "ring-2 ring-red-400/70";
    else if (status === "completed" || status === "created") ring = "ring-2 ring-emerald-400/45";

    const pulse = status === "running";

    setNodes((currentNodes) => {
      const posById = new Map(currentNodes.map((n) => [n.id, n.position]));
      const pickPos = (id: string, agent: SpecialistAgentProfile | undefined, fallback: { x: number; y: number }) =>
        posById.get(id) ?? resolveNodePosition(id, agent, fallback);

      const base = cloneNodes(STATIC_BASE_NODES)
        .filter((n) => !n.id.startsWith(SP_PREFIX) && !n.id.startsWith(SUB_NODE_PREFIX))
        .map((n) => {
          const p = posById.get(n.id) ?? loadCanvasPosition(n.id) ?? savedStaticRef.current[n.id];
          return p ? { ...n, position: p } : n;
        });
      let list: Node[] = base;

      if (!pending) {
        const positions = layoutAgentGrid(specialists.length);
        const specNodes: Node[] = specialists.map((p, i) => {
          const id = agentNodeId(p, i);
          const fallback = positions[i] ?? { x: 248, y: 318 };
          return {
          id,
          type: "specialist",
          position: pickPos(id, p, fallback),
          data: {
            name: p.name,
            role: p.role,
            skillsPreview: p.skills?.map((s) => s.label).join(" · ") ?? "",
            lane: p.canvasLane ?? "general",
            isLatest: activeMissionId != null && p.missionId === activeMissionId
          }
        };
        });
        list = [...base, ...specNodes];

        const resolvedMissionId =
          activeMissionId ??
          [...new Set(specialists.map((p) => p.missionId).filter(Boolean) as string[])].at(-1) ??
          null;
        const activeLead =
          (resolvedMissionId
            ? specialists.find((p) => p.missionId === resolvedMissionId && (p.subAgents?.length ?? 0) > 0)
            : undefined) ??
          specialists.find((p) => (p.subAgents?.length ?? 0) > 0) ??
          specialists.find((p) => p.missionId === resolvedMissionId) ??
          lead;
        const subs = activeLead.subAgents ?? [];

        if (subs.length > 0) {
          const leadIdx = specialists.findIndex(
            (p) => p.persistedId === activeLead.persistedId || p.name === activeLead.name
          );
          const leadPos = positions[leadIdx >= 0 ? leadIdx : 0] ?? { x: 248, y: 318 };
          const leadCenterX = leadPos.x + 110;
          const positionsSubs = layoutSubAgentPositions(subs.length, leadCenterX);
          const subNodes: Node[] = subs.map((s, i) => {
            const subId = `${SUB_NODE_PREFIX}${s.id}`;
            const fallback = positionsSubs[i] ?? { x: 80 + i * 210, y: leadPos.y + 150 };
            return {
            id: subId,
            type: "subAgent",
            position: pickPos(subId, undefined, fallback),
            data: {
              role: s.role,
              focus: s.focus,
              kind: inferSubAgentKind(s.role)
            }
          };
          });
          list = [...list, ...subNodes];
        }
      }

      const withData = list.map((node) => {
        const baseData: Record<string, unknown> = { ...(node.data as Record<string, unknown>), pulse };
        let data: Record<string, unknown> = baseData;
        if (node.id === "mother") {
          data = {
            ...baseData,
            ...(onOpenMotherDashboard ? { onConfigure: onOpenMotherDashboard } : {}),
            thinking: motherThinking,
            thinkingCurrent: motherProgressCurrent,
            thinkingHistory: motherProgressHistory
          };
        }
        if (node.id === "knowledge" && knowledgeStats) {
          data = {
            ...baseData,
            skillCount: knowledgeStats.skillCount,
            docCount: knowledgeStats.docCount
          };
        }
        return {
          ...node,
          className: ring,
          data
        };
      });

      return resolveNodeCollisions(withData);
    });

    setEdges(() => {
      const base = cloneEdges(STATIC_BASE_EDGES).filter(
        (e) => !e.id.startsWith("e-mother-spec-") && !e.id.startsWith("e-spec-sub-")
      );
      if (pending) return base;
      const motherToSpecs: Edge[] = specialists.map((p, i) => ({
        id: `e-mother-spec-${p.persistedId ?? i}`,
        source: "mother",
        target: agentNodeId(p, i),
        sourceHandle: "to-specialist",
        targetHandle: "from-mother",
        animated: true,
        style: { stroke: "#a78bfa" }
      }));

      const resolvedMissionId =
        activeMissionId ??
        [...new Set(specialists.map((p) => p.missionId).filter(Boolean) as string[])].at(-1) ??
        null;
      const activeLead =
        (resolvedMissionId
          ? specialists.find((p) => p.missionId === resolvedMissionId && (p.subAgents?.length ?? 0) > 0)
          : undefined) ??
        specialists.find((p) => (p.subAgents?.length ?? 0) > 0) ??
        specialists.find((p) => p.missionId === resolvedMissionId) ??
        lead;
      const subs = activeLead.subAgents ?? [];
      if (subs.length === 0) {
        return [...base, ...motherToSpecs];
      }
      const leadIdx = specialists.findIndex(
        (p) => p.persistedId === activeLead.persistedId || p.name === activeLead.name
      );
      const leadNodeId = agentNodeId(activeLead, leadIdx >= 0 ? leadIdx : 0);
      const subEdges: Edge[] = subs.map((s) => ({
        id: `e-spec-sub-${s.id}`,
        source: leadNodeId,
        target: `${SUB_NODE_PREFIX}${s.id}`,
        sourceHandle: "to-subagents",
        targetHandle: "from-specialist",
        animated: true,
        style: { stroke: "#e879f9", strokeWidth: 1.2 }
      }));
      return [...base, ...motherToSpecs, ...subEdges];
    });
  }, [
    specialists,
    status,
    setNodes,
    setEdges,
    onOpenMotherDashboard,
    motherThinking,
    motherProgressCurrent,
    motherProgressHistory,
    activeMissionId,
    knowledgeStats
  ]);

  const defaultEdgeOptions = useMemo(
    () => ({
      style: { stroke: "#94A3B8", strokeWidth: 1.4 },
      interactionWidth: 24
    }),
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeDragStop={onNodeDragStop}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.5}
      maxZoom={1.35}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={defaultEdgeOptions}
      className="h-full text-slate-100"
    >
      <Background gap={18} size={1.2} variant={BackgroundVariant.Dots} color="#1f2a3d" />
    </ReactFlow>
  );
}

type MissionCanvasProps = {
  status: string;
  specialists: SpecialistAgentProfile[];
  onSelectAgent?: (target: AgentDashboardTarget) => void;
  onOpenMotherDashboard?: () => void;
  motherThinking?: boolean;
  motherProgressCurrent?: MissionProgressEvent | null;
  motherProgressHistory?: MissionProgressEvent[];
  activeMissionId?: string | null;
  knowledgeStats?: { skillCount: number; docCount: number } | null;
};

export function MissionCanvas({
  status,
  specialists,
  activeMissionId,
  onSelectAgent,
  onOpenMotherDashboard,
  motherThinking,
  motherProgressCurrent,
  motherProgressHistory,
  knowledgeStats
}: MissionCanvasProps) {
  return (
    <section className="flex h-full min-h-[min(56vh,560px)] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#050f1f] via-[#061222] to-[#030914] shadow-inner shadow-black/40">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate">Canvas</p>
          <h2 className="text-sm font-semibold tracking-tight text-white sm:text-base">Mission workflow</h2>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-slate">
          <span className="text-slate">Status</span>{" "}
          <span className="font-medium text-electric">{status}</span>
        </span>
      </header>
      <p className="border-b border-white/10 px-4 py-2 text-[10px] leading-relaxed text-slate sm:px-5">
        Node <span className="text-electric">Central Agent</span>: tombol <strong className="text-white">Central dashboard</strong>
        . Klik <span className="text-violet-300">specialist</span> / <span className="text-fuchsia-300">sub-agent</span>{" "}
        untuk dashboard mereka.
      </p>
      <div className="relative min-h-0 flex-1">
        <ReactFlowProvider>
          <FlowSurface
            status={status}
            specialists={specialists}
            onSelectAgent={onSelectAgent}
            onOpenMotherDashboard={onOpenMotherDashboard}
            motherThinking={motherThinking}
            motherProgressCurrent={motherProgressCurrent}
            motherProgressHistory={motherProgressHistory}
            activeMissionId={activeMissionId}
            knowledgeStats={knowledgeStats}
          />
        </ReactFlowProvider>
      </div>
    </section>
  );
}
