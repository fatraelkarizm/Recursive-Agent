"use client";

type AppHeaderProps = {
  status: string;
  squadSource: string | null;
};

export function AppHeader({ status, squadSource }: AppHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#050f1f]/90 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-electric/30 bg-electric/10 text-sm font-bold text-electric">
          RA
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-white sm:text-base">Recursive Agent</h1>
          <p className="text-[10px] text-slate">Mission control · Central Agent squad</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        {squadSource ? (
          <span className="hidden rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-violet-200 sm:inline">
            Squad: {squadSource}
          </span>
        ) : null}
        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
          <span className="text-slate">Worker</span>{" "}
          <span className="font-medium text-electric">{status}</span>
        </span>
      </div>
    </header>
  );
}
