"use client";

import type { MissionProgressEvent } from "@/lib/types";

type MotherThoughtCloudProps = {
  active: boolean;
  current: MissionProgressEvent | null;
  history: MissionProgressEvent[];
};

const PHASE_GLOW: Record<string, string> = {
  "mother-planning": "thought-glow-violet",
  "mother-spawn": "thought-glow-electric",
  "mother-review": "thought-glow-amber",
  "specialist-readme": "thought-glow-sky",
  "fleet-run": "thought-glow-emerald",
  "fleet-merge": "thought-glow-indigo",
  tools: "thought-glow-slate",
  persist: "thought-glow-electric",
  done: "thought-glow-electric"
};

export function MotherThoughtCloud({ active, current, history }: MotherThoughtCloudProps) {
  if (!active) return null;

  const glowClass = current ? PHASE_GLOW[current.phase] ?? "thought-glow-violet" : "thought-glow-violet";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className={`thought-orb ${glowClass}`} aria-hidden />
      <div className={`thought-orb thought-orb-delay ${glowClass}`} aria-hidden />
      <div className="relative mx-6 max-w-lg animate-thought-card rounded-2xl border border-white/15 bg-[#0a1628ee] px-6 py-5 shadow-[0_0_60px_rgba(100,255,218,0.14)] backdrop-blur-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-electric/90">Mother agent</p>
        <p className="mt-2 text-lg font-semibold text-white">{current?.label ?? "Memproses…"}</p>
        {current?.detail ? (
          <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-slate">{current.detail}</p>
        ) : null}
        <ul className="mt-4 max-h-28 space-y-1 overflow-y-auto text-[11px] text-slate/90">
          {history
            .slice(-6)
            .reverse()
            .map((h, i) => (
              <li key={`${h.at}-${h.phase}-${i}`} className="flex gap-2">
                <span className="shrink-0 text-electric/70">◦</span>
                <span className="truncate">{h.label}</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
