"use client";

import type { MissionProgressEvent } from "@/lib/types";

type MotherThoughtBubbleProps = {
  current: MissionProgressEvent | null;
  history: MissionProgressEvent[];
};

const PHASE_DOT: Record<string, string> = {
  "mother-planning": "bg-violet-400",
  "mother-spawn": "bg-electric",
  "mother-review": "bg-amber-400",
  "specialist-readme": "bg-sky-400",
  "fleet-run": "bg-emerald-400",
  "fleet-merge": "bg-indigo-400",
  tools: "bg-slate-400",
  persist: "bg-electric",
  done: "bg-emerald-300"
};

/** Compact thought UI anchored above the Central Agent node (via NodeToolbar). */
export function MotherThoughtBubble({ current, history }: MotherThoughtBubbleProps) {
  const dot = current ? PHASE_DOT[current.phase] ?? "bg-violet-400" : "bg-violet-400";

  return (
    <div className="pointer-events-none w-[min(300px,72vw)] animate-thought-card rounded-xl border border-electric/35 bg-[#0a1628f2] px-3.5 py-3 shadow-[0_8px_40px_rgba(100,255,218,0.18)] backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 animate-pulse rounded-full ${dot}`} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-electric/90">Central</p>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-snug text-white">{current?.label ?? "Memproses…"}</p>
      {current?.detail ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate">{current.detail}</p>
      ) : null}
      {history.length > 1 ? (
        <ol className="mt-2 max-h-16 space-y-0.5 overflow-hidden border-t border-white/10 pt-2 text-[10px] text-slate/85">
          {history
            .slice(-4)
            .reverse()
            .map((h, i) => (
              <li key={`${h.at}-${h.phase}-${i}`} className="truncate">
                {h.label}
              </li>
            ))}
        </ol>
      ) : null}
    </div>
  );
}
