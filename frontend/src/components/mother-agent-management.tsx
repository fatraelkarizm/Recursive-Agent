"use client";

import { Trash2, Eye, EyeOff, LayoutGrid } from "lucide-react";
import type { SpecialistAgentProfile } from "@/lib/types";
import type { CanvasViewMode } from "@/lib/canvas-agent-prefs";

type MotherAgentManagementProps = {
  agents: SpecialistAgentProfile[];
  activeMissionId: string | null;
  hiddenIds: Set<string>;
  viewMode: CanvasViewMode;
  onViewModeChange: (mode: CanvasViewMode) => void;
  onToggleHidden: (persistedId: string) => void;
  onDeleteAgent: (persistedId: string) => void;
  onKeepLatestMission: () => void;
  onClearAll: () => void;
  busy?: boolean;
};

export function MotherAgentManagement({
  agents,
  activeMissionId,
  hiddenIds,
  viewMode,
  onViewModeChange,
  onToggleHidden,
  onDeleteAgent,
  onKeepLatestMission,
  onClearAll,
  busy
}: MotherAgentManagementProps) {
  const visibleOnCanvas =
    viewMode === "latest-mission" && activeMissionId
      ? agents.filter((a) => a.missionId === activeMissionId && !hiddenIds.has(a.persistedId ?? ""))
      : agents.filter((a) => !hiddenIds.has(a.persistedId ?? ""));

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border border-violet-400/25 bg-violet-500/10 p-3">
        <p className="text-xs leading-relaxed text-slate">
          Kelola agent di canvas. Default: <strong className="text-white">hanya misi terakhir</strong> supaya tidak
          pusing. Node baru otomatis geser kalau menabrak kotak lain.
        </p>
        <p className="mt-2 text-[11px] text-slate/80">
          Di canvas: <span className="text-electric">{visibleOnCanvas.length}</span> tampil · Total DB:{" "}
          <span className="text-white">{agents.length}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onViewModeChange("latest-mission")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            viewMode === "latest-mission"
              ? "border-electric/50 bg-electric/15 text-electric"
              : "border-white/15 text-slate hover:bg-white/5"
          }`}
        >
          Hanya misi terakhir
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onViewModeChange("all")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            viewMode === "all"
              ? "border-electric/50 bg-electric/15 text-electric"
              : "border-white/15 text-slate hover:bg-white/5"
          }`}
        >
          Semua agent
        </button>
        <button
          type="button"
          disabled={busy || !activeMissionId}
          onClick={onKeepLatestMission}
          className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
        >
          Hapus agent misi lama (DB)
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClearAll}
          className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-40"
        >
          Kosongkan semua agent
        </button>
      </div>

      <ul className="max-h-[min(50vh,420px)] space-y-2 overflow-y-auto pr-1">
        {agents.length === 0 ? (
          <li className="text-slate">Belum ada agent tersimpan.</li>
        ) : (
          agents.map((a) => {
            const id = a.persistedId ?? a.name;
            const hidden = hiddenIds.has(a.persistedId ?? "");
            const isLatest = activeMissionId != null && a.missionId === activeMissionId;
            return (
              <li
                key={id}
                className={`flex items-start gap-2 rounded-lg border p-2.5 ${
                  isLatest ? "border-electric/30 bg-electric/5" : "border-white/10 bg-black/20"
                }`}
              >
                <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{a.name}</p>
                  <p className="truncate text-[11px] text-slate">{a.role}</p>
                  <p className="text-[10px] text-slate/70">
                    {a.canvasLane ?? "general"}
                    {a.missionId ? ` · mission ${a.missionId.slice(0, 8)}…` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    title={hidden ? "Tampilkan di canvas" : "Sembunyikan dari canvas"}
                    disabled={busy || !a.persistedId}
                    onClick={() => a.persistedId && onToggleHidden(a.persistedId)}
                    className="rounded border border-white/10 p-1.5 text-slate hover:bg-white/10 hover:text-white disabled:opacity-40"
                  >
                    {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    title="Hapus permanen"
                    disabled={busy || !a.persistedId}
                    onClick={() => a.persistedId && onDeleteAgent(a.persistedId)}
                    className="rounded border border-red-400/20 p-1.5 text-red-300 hover:bg-red-500/15 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
