"use client";

import { memo } from "react";
import { Handle, NodeToolbar, Position, type NodeProps } from "@xyflow/react";
import { MotherThoughtBubble } from "@/components/mother-thought-bubble";
import type { MissionProgressEvent } from "@/lib/types";
import { Bot, BookOpen, ClipboardCheck, Database, GitBranch, Globe, LayoutTemplate, Search, Wrench, Zap } from "lucide-react";

type LabelData = { label: string };
type ActionData = { label: string; sub: string };

export const TriggerNode = memo(function TriggerNode({ data }: NodeProps) {
  const { label } = data as LabelData;
  return (
    <div className="min-w-[160px] rounded-lg border border-sky-500/60 bg-slate-950/90 px-3 py-2 shadow-md">
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-sky-400" />
      <div className="flex items-center gap-2 text-xs font-semibold text-sky-200">
        <Zap className="h-4 w-4 text-amber-400" aria-hidden />
        {label}
      </div>
    </div>
  );
});

type MotherNodeData = LabelData & {
  onConfigure?: () => void;
  pulse?: boolean;
  thinking?: boolean;
  thinkingCurrent?: MissionProgressEvent | null;
  thinkingHistory?: MissionProgressEvent[];
};

export const MotherAgentNode = memo(function MotherAgentNode({ data }: NodeProps) {
  const { label, onConfigure, thinking, thinkingCurrent, thinkingHistory } = data as MotherNodeData;
  return (
    <>
      {thinking ? (
        <NodeToolbar isVisible position={Position.Top} offset={12} className="!bg-transparent !border-0 !shadow-none">
          <MotherThoughtBubble current={thinkingCurrent ?? null} history={thinkingHistory ?? []} />
        </NodeToolbar>
      ) : null}
    <div className="min-w-[220px] max-w-[260px] rounded-xl border-2 border-electric/70 bg-[#0b1f36] px-3 py-3 shadow-lg">
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-electric" />
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 text-xs font-semibold text-electric">
        <Bot className="h-4 w-4" aria-hidden />
        {label}
      </div>
      <ul className="mt-2 space-y-1.5 text-[11px] text-slate">
        <li className="rounded border border-dashed border-white/15 bg-black/20 px-2 py-1">Chat model</li>
        <li className="rounded border border-dashed border-white/15 bg-black/20 px-2 py-1">Konteks + URL (modal)</li>
        <li className="rounded border border-dashed border-white/15 bg-black/20 px-2 py-1">MCP / Tavily</li>
      </ul>
      {onConfigure ? (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onConfigure();
          }}
          className="mt-2 w-full rounded-lg border border-electric/40 bg-electric/10 px-2 py-1.5 text-[10px] font-semibold text-electric hover:bg-electric/20"
        >
          Central dashboard
        </button>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        id="to-branch"
        className="!h-2 !w-2 !border-0 !bg-electric"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="to-specialist"
        className="!h-2 !w-2 !border-0 !bg-violet-400"
        style={{ left: "50%" }}
      />
    </div>
    </>
  );
});

type SpecialistNodeData = {
  name: string;
  role: string;
  skillsPreview: string;
  lane?: "frontend" | "backend" | "general";
  activity?: { label: string; detail?: string; phase?: string } | null;
};

function specialistShellClass(lane: SpecialistNodeData["lane"]) {
  if (lane === "frontend") return "border-cyan-400/85 bg-[#061a24]";
  if (lane === "backend") return "border-amber-400/80 bg-[#1a1006]";
  return "border-violet-400/80 bg-[#14082a]";
}

function specialistTitleClass(lane: SpecialistNodeData["lane"]) {
  if (lane === "frontend") return "text-cyan-100";
  if (lane === "backend") return "text-amber-100";
  return "text-violet-200";
}

function SpecialistLaneIcon({ lane }: { lane: SpecialistNodeData["lane"] }) {
  const cls = "h-4 w-4 shrink-0";
  if (lane === "frontend") return <LayoutTemplate className={`${cls} text-cyan-300`} aria-hidden />;
  if (lane === "backend") return <Database className={`${cls} text-amber-300`} aria-hidden />;
  return <Bot className={`${cls} text-violet-300`} aria-hidden />;
}

export const SpecialistAgentNode = memo(function SpecialistAgentNode({ data }: NodeProps) {
  const { name, role, skillsPreview, lane, activity } = data as SpecialistNodeData;
  const laneResolved = lane ?? "general";
  const isActive = !!activity;
  return (
    <div
      className={`relative min-w-[220px] max-w-[280px] cursor-pointer rounded-xl border-2 px-3 py-3 shadow-lg transition hover:brightness-110 ${specialistShellClass(laneResolved)} ${isActive ? "ring-1 ring-electric/40" : ""}`}
      title="Klik untuk buka dashboard"
    >
      {isActive && (
        <div className="absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-electric/30 bg-[#0a1628]/95 px-3 py-1.5 shadow-lg shadow-electric/10">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-electric" />
            <span className="text-[10px] font-semibold text-electric">{activity!.label}</span>
          </div>
          {activity!.detail && (
            <p className="mt-0.5 max-w-[200px] truncate text-[9px] text-slate">{activity!.detail}</p>
          )}
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        id="from-mother"
        className="!h-2 !w-2 !border-0 !bg-violet-300"
      />
      <div
        className={`flex items-center gap-2 border-b border-white/10 pb-2 text-xs font-semibold ${specialistTitleClass(laneResolved)}`}
      >
        <SpecialistLaneIcon lane={laneResolved} />
        <span className="truncate">{name}</span>
        {isActive && <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-electric" />}
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate">Specialist agent</p>
      <p className="mt-0.5 font-mono text-[11px] text-white/90">{role}</p>
      <p className="mt-2 line-clamp-3 text-[10px] leading-snug text-slate">{skillsPreview || "Skills: —"}</p>
      <Handle type="source" position={Position.Right} id="specialist-out" className="!h-2 !w-2 !border-0 !bg-violet-400" />
      <Handle
        type="source"
        position={Position.Bottom}
        id="to-subagents"
        className="!h-2 !w-2 !border-0 !bg-fuchsia-400"
        style={{ left: "50%" }}
      />
    </div>
  );
});

type SubAgentNodeData = {
  role: string;
  focus: string;
  kind: "scout" | "worker" | "reviewer";
};

function subAgentIcon(kind: SubAgentNodeData["kind"]) {
  const cls = "h-4 w-4 shrink-0";
  if (kind === "scout") return <Search className={`${cls} text-cyan-300`} aria-hidden />;
  if (kind === "worker") return <Wrench className={`${cls} text-amber-300`} aria-hidden />;
  return <ClipboardCheck className={`${cls} text-emerald-300`} aria-hidden />;
}

function subAgentBorder(kind: SubAgentNodeData["kind"]) {
  if (kind === "scout") return "border-cyan-500/70 bg-[#061a1f]";
  if (kind === "worker") return "border-amber-500/65 bg-[#1a1208]";
  return "border-emerald-500/65 bg-[#061a14]";
}

export const SubAgentNode = memo(function SubAgentNode({ data }: NodeProps) {
  const { role, focus, kind } = data as SubAgentNodeData;
  const label =
    kind === "scout" ? "Scout" : kind === "worker" ? "Worker" : "Reviewer";

  return (
    <div
      className={`min-w-[176px] max-w-[200px] cursor-pointer rounded-xl border-2 px-2.5 py-2.5 shadow-lg transition hover:brightness-110 ${subAgentBorder(kind)}`}
      title="Klik untuk buka dashboard"
    >
      <Handle
        type="target"
        position={Position.Top}
        id="from-specialist"
        className="!h-2 !w-2 !border-0 !bg-fuchsia-300"
      />
      <div className="flex items-start gap-2 border-b border-white/10 pb-1.5">
        {subAgentIcon(kind)}
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate">{label}</p>
          <p className="truncate font-mono text-[10px] font-medium text-white/90">{role}</p>
        </div>
      </div>
      <p className="mt-1.5 line-clamp-4 text-[9px] leading-snug text-slate">{focus}</p>
    </div>
  );
});

export const BranchNode = memo(function BranchNode({ data }: NodeProps) {
  const { label } = data as LabelData;
  return (
    <div className="min-w-[140px] rounded-lg border border-emerald-500/50 bg-emerald-950/40 px-3 py-2 text-center shadow-md">
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-emerald-400" />
      <div className="flex items-center justify-center gap-1 text-xs font-semibold text-emerald-100">
        <GitBranch className="h-4 w-4" aria-hidden />
        {label}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="yes"
        className="!h-2 !w-2 !border-0 !bg-emerald-300"
        style={{ top: "35%" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="no"
        className="!h-2 !w-2 !border-0 !bg-emerald-300"
        style={{ top: "70%" }}
      />
    </div>
  );
});

export const ActionNode = memo(function ActionNode({ data }: NodeProps) {
  const { label, sub } = data as ActionData;
  return (
    <div className="min-w-[150px] rounded-lg border border-slate/50 bg-slate-900/90 px-3 py-2 shadow-md">
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate" />
      <div className="text-xs font-semibold text-white">{label}</div>
      <div className="mt-1 text-[10px] text-slate">{sub}</div>
    </div>
  );
});

type KnowledgeNodeData = {
  label: string;
  sources: string[];
  skillCount: number;
  docCount: number;
};

export const KnowledgeNode = memo(function KnowledgeNode({ data }: NodeProps) {
  const { label, sources, skillCount, docCount } = data as KnowledgeNodeData;
  return (
    <div className="min-w-[200px] max-w-[260px] rounded-xl border-2 border-teal-400/70 bg-[#051a1a] px-3 py-3 shadow-lg">
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-teal-400" />
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 text-xs font-semibold text-teal-200">
        <BookOpen className="h-4 w-4 text-teal-300" aria-hidden />
        {label}
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] text-slate">
          <Globe className="h-3 w-3 text-teal-400" aria-hidden />
          <span className="text-white font-mono">{docCount}</span> sumber web
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate">
          <Search className="h-3 w-3 text-teal-400" aria-hidden />
          <span className="text-white font-mono">{skillCount}</span> skills extracted
        </div>
        {sources.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {sources.slice(0, 5).map((s) => (
              <li key={s} className="truncate rounded border border-dashed border-teal-500/30 bg-black/20 px-2 py-0.5 text-[9px] text-teal-100/80">
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});
