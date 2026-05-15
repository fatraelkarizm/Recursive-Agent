"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
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
  action: ActionNode
} satisfies NodeTypes;

function layoutSpecialistPositions(n: number): { x: number; y: number }[] {
  if (n <= 1) return [{ x: 248, y: 318 }];
  const w = 232;
  const gap = 36;
  const total = n * w + (n - 1) * gap;
  const cx = 360;
  const x0 = cx - total / 2;
  return Array.from({ length: n }, (_, i) => ({
    x: Math.round(x0 + i * (w + gap)),
    y: 300
  }));
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
    data: { label: "Mother agent (tools)" }
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
    id: "sandbox",
    type: "action",
    position: { x: 820, y: 220 },
    data: { label: "Sandbox path", sub: "E2B code / command runner" }
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
    id: "e-branch-sandbox",
    source: "branch",
    target: "sandbox",
    sourceHandle: "no",
    label: "execute",
    style: { stroke: "#38BDF8" }
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
  onSelectAgent?: (target: AgentDashboardTarget) => void;
  onOpenMotherDashboard?: () => void;
};

function FlowSurface({ status, specialists, onSelectAgent, onOpenMotherDashboard }: FlowSurfaceProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(cloneNodes(STATIC_BASE_NODES));
  const [edges, setEdges, onEdgesChange] = useEdgesState(cloneEdges(STATIC_BASE_EDGES));

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (!onSelectAgent) return;
      if (node.id.startsWith(SP_PREFIX)) {
        const idx = parseInt(node.id.slice(SP_PREFIX.length), 10);
        if (!Number.isNaN(idx)) onSelectAgent({ kind: "specialist", index: idx });
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

    setNodes(() => {
      const base = cloneNodes(STATIC_BASE_NODES).filter(
        (n) => !n.id.startsWith(SP_PREFIX) && !n.id.startsWith(SUB_NODE_PREFIX)
      );
      let list: Node[] = base;

      if (!pending) {
        const positions = layoutSpecialistPositions(specialists.length);
        const specNodes: Node[] = specialists.map((p, i) => ({
          id: `${SP_PREFIX}${i}`,
          type: "specialist",
          position: positions[i] ?? { x: 248, y: 318 },
          data: {
            name: p.name,
            role: p.role,
            skillsPreview: p.skills?.map((s) => s.label).join(" · ") ?? "",
            lane: p.canvasLane ?? "general"
          }
        }));
        list = [...base, ...specNodes];

        const subs = lead.subAgents ?? [];
        if (subs.length > 0) {
          const leadPos = positions[0] ?? { x: 248, y: 318 };
          const leadCenterX = leadPos.x + 110;
          const positionsSubs = layoutSubAgentPositions(subs.length, leadCenterX);
          const subNodes: Node[] = subs.map((s, i) => ({
            id: `${SUB_NODE_PREFIX}${s.id}`,
            type: "subAgent",
            position: positionsSubs[i] ?? { x: 80 + i * 210, y: 468 },
            data: {
              role: s.role,
              focus: s.focus,
              kind: inferSubAgentKind(s.role)
            }
          }));
          list = [...list, ...subNodes];
        }
      }

      return list.map((node) => {
        const baseData = { ...(node.data as object), pulse };
        const data =
          node.id === "mother" && onOpenMotherDashboard
            ? { ...baseData, onConfigure: onOpenMotherDashboard }
            : baseData;
        return {
          ...node,
          className: ring,
          data
        };
      });
    });

    setEdges(() => {
      const base = cloneEdges(STATIC_BASE_EDGES).filter(
        (e) => !e.id.startsWith("e-mother-spec-") && !e.id.startsWith("e-spec-sub-")
      );
      if (pending) return base;
      const motherToSpecs: Edge[] = specialists.map((_, i) => ({
        id: `e-mother-spec-${i}`,
        source: "mother",
        target: `${SP_PREFIX}${i}`,
        sourceHandle: "to-specialist",
        targetHandle: "from-mother",
        animated: true,
        style: { stroke: "#a78bfa" }
      }));
      const subs = lead.subAgents ?? [];
      if (subs.length === 0) {
        return [...base, ...motherToSpecs];
      }
      const subEdges: Edge[] = subs.map((s) => ({
        id: `e-spec-sub-${s.id}`,
        source: `${SP_PREFIX}0`,
        target: `${SUB_NODE_PREFIX}${s.id}`,
        sourceHandle: "to-subagents",
        targetHandle: "from-specialist",
        animated: true,
        style: { stroke: "#e879f9", strokeWidth: 1.2 }
      }));
      return [...base, ...motherToSpecs, ...subEdges];
    });
  }, [specialists, status, setNodes, setEdges, onOpenMotherDashboard]);

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
      <MiniMap
        className="!bg-slate-950/80 !border !border-white/10"
        nodeStrokeColor="#64FFDA"
        maskColor="rgba(2, 12, 27, 0.65)"
      />
      <Controls className="!bg-slate-950/90 !border !border-white/10 !shadow-lg" />
    </ReactFlow>
  );
}

type MissionCanvasProps = {
  status: string;
  specialists: SpecialistAgentProfile[];
  onSelectAgent?: (target: AgentDashboardTarget) => void;
  onOpenMotherDashboard?: () => void;
};

export function MissionCanvas({ status, specialists, onSelectAgent, onOpenMotherDashboard }: MissionCanvasProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#050f1f] via-[#061222] to-[#030914] shadow-inner shadow-black/40">
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
        Node <span className="text-electric">Mother</span>: tombol <strong className="text-white">Mother dashboard</strong>
        . Klik <span className="text-violet-300">specialist</span> / <span className="text-fuchsia-300">sub-agent</span>{" "}
        untuk dashboard mereka.
      </p>
      <div className="relative min-h-[420px] flex-1">
        <ReactFlowProvider>
          <FlowSurface
            status={status}
            specialists={specialists}
            onSelectAgent={onSelectAgent}
            onOpenMotherDashboard={onOpenMotherDashboard}
          />
        </ReactFlowProvider>
      </div>
    </section>
  );
}
