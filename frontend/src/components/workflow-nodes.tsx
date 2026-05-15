"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot, GitBranch, Zap } from "lucide-react";

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

export const MotherAgentNode = memo(function MotherAgentNode({ data }: NodeProps) {
  const { label } = data as LabelData;
  return (
    <div className="min-w-[220px] max-w-[260px] rounded-xl border-2 border-electric/70 bg-[#0b1f36] px-3 py-3 shadow-lg">
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-electric" />
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 text-xs font-semibold text-electric">
        <Bot className="h-4 w-4" aria-hidden />
        {label}
      </div>
      <ul className="mt-2 space-y-1.5 text-[11px] text-slate">
        <li className="rounded border border-dashed border-white/15 bg-black/20 px-2 py-1">Chat model</li>
        <li className="rounded border border-dashed border-white/15 bg-black/20 px-2 py-1">Postgres memory (planned)</li>
        <li className="rounded border border-dashed border-white/15 bg-black/20 px-2 py-1">MCP tools</li>
      </ul>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-electric" />
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
