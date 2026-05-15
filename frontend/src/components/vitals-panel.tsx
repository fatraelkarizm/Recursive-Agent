"use client";

type VitalsPanelProps = {
  status: string;
  elapsedMs?: number | null;
  agentCount?: number;
  skillCount?: number;
  docCount?: number;
};

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

function statusColor(status: string): string {
  if (status === "running") return "text-amber-400";
  if (status === "completed") return "text-emerald-400";
  if (status === "failed") return "text-rose-400";
  return "text-electric";
}

export function VitalsPanel({ status, elapsedMs, agentCount = 0, skillCount = 0, docCount = 0 }: VitalsPanelProps) {
  return (
    <section className="flex h-full min-h-[200px] flex-col rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-black/30 shadow-inner shadow-black/30">
      <header className="border-b border-white/10 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate">Vitals</p>
        <h3 className="text-sm font-semibold text-white">Mission health</h3>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <span className="text-xs text-slate">Status</span>
          <span className={`text-xs font-semibold ${statusColor(status)}`}>{status || "idle"}</span>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <span className="text-xs text-slate">Waktu produce</span>
          <span className="font-mono text-xs text-white">
            {elapsedMs != null && elapsedMs > 0
              ? formatElapsed(elapsedMs)
              : status === "running"
                ? "0s"
                : "--"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <span className="text-xs text-slate">Agent produced</span>
          <span className="font-mono text-xs text-electric">{agentCount}</span>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <span className="text-xs text-slate">Skills injected</span>
          <span className="font-mono text-xs text-teal-300">{skillCount}</span>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <span className="text-xs text-slate">Web sources</span>
          <span className="font-mono text-xs text-violet-300">{docCount}</span>
        </div>
      </div>
    </section>
  );
}
