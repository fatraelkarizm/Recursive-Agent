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
  type NodeTypes
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ActionNode, BranchNode, MotherAgentNode, TriggerNode } from "@/components/workflow-nodes";

const nodeTypes = {
  trigger: TriggerNode,
  mother: MotherAgentNode,
  branch: BranchNode,
  action: ActionNode
} satisfies NodeTypes;

const baseNodes: Node[] = [
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

const baseEdges: Edge[] = [
  { id: "e-trigger-mother", source: "trigger", target: "mother", animated: true },
  { id: "e-mother-branch", source: "mother", target: "branch" },
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

type MissionCanvasProps = {
  status: string;
};

function FlowSurface({ status }: MissionCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges]
  );

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => {
        let ring = "";
        if (status === "running") ring = "ring-2 ring-amber-300/60";
        else if (status === "failed") ring = "ring-2 ring-red-400/70";
        else if (status === "completed" || status === "created") ring = "ring-2 ring-emerald-400/45";

        return {
          ...node,
          className: ring,
          data: {
            ...node.data,
            pulse: status === "running"
          }
        };
      })
    );
  }, [setNodes, status]);

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

export function MissionCanvas({ status }: MissionCanvasProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#050f1f] to-[#030914]">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate">Canvas</p>
          <h2 className="text-sm font-semibold text-white">Mission workflow</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate">
          Status: <span className="text-electric">{status}</span>
        </span>
      </header>
      <div className="relative min-h-[420px] flex-1">
        <ReactFlowProvider>
          <FlowSurface status={status} />
        </ReactFlowProvider>
      </div>
    </section>
  );
}
