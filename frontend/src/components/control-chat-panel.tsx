"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Send } from "lucide-react";
import { SpecialistAgentPanel } from "@/components/specialist-agent-panel";
import type { AgentDashboardTarget } from "@/components/agent-dashboard-modal";
import type { ChatMessage, FleetOrchestrationSummary, SpecialistAgentProfile } from "@/lib/types";

type ControlChatPanelProps = {
  messages: ChatMessage[];
  onMessagesChange: (next: ChatMessage[]) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  status: string;
  profile: SpecialistAgentProfile;
  specialists: SpecialistAgentProfile[];
  fleetSummary: FleetOrchestrationSummary | null;
  onOpenAgentDashboard: (target: AgentDashboardTarget) => void;
  onOpenMotherDashboard: () => void;
  onRunMission: () => void;
  busy: boolean;
};

function squadTabLabel(s: SpecialistAgentProfile, index: number): string {
  if (s.canvasLane === "frontend") return "Frontend";
  if (s.canvasLane === "backend") return "Backend";
  return index === 0 ? "Specialist" : `Agent ${index + 1}`;
}

export function ControlChatPanel({
  messages,
  onMessagesChange,
  prompt,
  onPromptChange,
  status,
  profile,
  specialists,
  fleetSummary,
  onOpenAgentDashboard,
  onOpenMotherDashboard,
  onRunMission,
  busy
}: ControlChatPanelProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [specialistTab, setSpecialistTab] = useState(0);
  const activeTab = specialistTab < specialists.length ? specialistTab : 0;
  const shownProfile = specialists[activeTab] ?? profile;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function appendMessage(message: ChatMessage) {
    onMessagesChange([...messages, message]);
  }

  function handleSend() {
    if (!prompt.trim()) return;
    appendMessage({
      id: nanoid(),
      role: "user",
      content: prompt.trim(),
      at: Date.now()
    });
    onRunMission();
  }

  return (
    <aside className="flex h-full w-[400px] shrink-0 flex-col border-l border-white/10 bg-gradient-to-b from-black/40 to-black/20">
      <div className="border-b border-white/10 px-4 py-4 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate">Control</p>
        <h2 className="text-base font-semibold tracking-tight text-white">Mission chat</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate">
          Prompt di sini → <strong className="text-white/90">Run mission</strong>. Mother: Services (baca docs), konteks,
          URL, dan catatan review lewat{" "}
          <button
            type="button"
            onClick={onOpenMotherDashboard}
            className="font-semibold text-violet-300 underline decoration-violet-500/40 underline-offset-2 hover:text-violet-200"
          >
            dashboard Mother
          </button>{" "}
          (juga dari node Mother di canvas).
        </p>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/15 bg-white/5 px-3 py-3 text-xs text-slate">
            Tulis misi, lalu Run. Setelah ada hasil, iterasi: buka dashboard Mother, isi review / Services, simpan, Run
            lagi.
          </p>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[95%] rounded-2xl border px-3 py-2 text-sm leading-relaxed shadow-sm ${
              message.role === "user"
                ? "ml-auto border-electric/30 bg-electric/10 text-white"
                : "mr-auto border-white/10 bg-slate-900/70 text-slate-100"
            }`}
          >
            <p className="text-[10px] uppercase tracking-wide text-slate">{message.role}</p>
            <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-4 py-4">
        <label className="text-[11px] font-semibold text-slate" htmlFor="mission-input">
          Prompt
        </label>
        <textarea
          id="mission-input"
          rows={4}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Contoh: buat specialist CMS artikel dengan Next.js…"
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none transition focus:border-electric/60"
        />
        <div className="mt-3">
          <button
            type="button"
            onClick={handleSend}
            disabled={busy || !prompt.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-electric px-3 py-2.5 text-sm font-semibold text-navy transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden />
            Run mission
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate">Worker: {status}</p>
      </div>

      <div className="border-t border-white/10 px-4 py-4">
        {specialists.length > 1 ? (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {specialists.map((s, i) => (
              <button
                key={`${s.name}-${i}`}
                type="button"
                onClick={() => setSpecialistTab(i)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                  activeTab === i
                    ? "border-electric/60 bg-electric/15 text-electric"
                    : "border-white/10 bg-white/5 text-slate hover:border-white/20"
                }`}
              >
                {squadTabLabel(s, i)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onOpenAgentDashboard({ kind: "specialist", index: activeTab })}
              className="ml-auto rounded-lg border border-electric/40 bg-electric/10 px-2.5 py-1 text-[11px] font-medium text-electric hover:bg-electric/20"
            >
              Dashboard
            </button>
          </div>
        ) : (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => onOpenAgentDashboard({ kind: "specialist", index: 0 })}
              className="rounded-lg border border-electric/40 bg-electric/10 px-2.5 py-1 text-[11px] font-medium text-electric hover:bg-electric/20"
            >
              Dashboard specialist
            </button>
          </div>
        )}
        <SpecialistAgentPanel profile={shownProfile} variant="embedded" />
        {fleetSummary?.mergedReport ? (
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-electric">Fleet → mother</span>
              <button
                type="button"
                className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-electric hover:bg-white/10"
                onClick={() => void navigator.clipboard.writeText(fleetSummary.mergedReport)}
              >
                Copy full report
              </button>
            </div>
            <p className="mb-2 text-[10px] text-slate">
              Sub-agent: buka dashboard masing-masing. Ringkas mother: tombol di atas.
            </p>
            <div className="space-y-2">
              {fleetSummary.subAgentRuns.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-white">{r.role}</span>
                    <span
                      className={
                        r.source === "skipped"
                          ? "rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] text-amber-200"
                          : "rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-200"
                      }
                    >
                      {r.source}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate">{r.output}</p>
                  <button
                    type="button"
                    onClick={() => onOpenAgentDashboard({ kind: "sub", subId: r.id })}
                    className="mt-2 text-[10px] font-medium text-electric hover:underline"
                  >
                    Buka dashboard sub-agent
                  </button>
                </div>
              ))}
            </div>
            <details className="mt-3 rounded-lg border border-white/10 bg-black/20">
              <summary className="cursor-pointer px-3 py-2 text-[10px] font-medium text-slate hover:text-white">
                Tampilkan laporan merged penuh
              </summary>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-white/10 p-3 font-mono text-[10px] leading-relaxed text-slate-100">
                {fleetSummary.mergedReport}
              </pre>
            </details>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
