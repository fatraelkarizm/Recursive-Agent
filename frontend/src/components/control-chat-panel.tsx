"use client";

import { useRef } from "react";
import { nanoid } from "nanoid";
import { Send } from "lucide-react";
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
  const userMessages = messages.filter((m) => m.role === "user");

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
    <aside className="flex h-full w-[min(100%,380px)] shrink-0 flex-col border-l border-white/10 bg-gradient-to-b from-black/40 to-black/20 sm:w-[380px]">
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate">Control</p>
        <h2 className="text-base font-semibold text-white">Mission chat</h2>
        <p className="mt-1 text-[11px] leading-snug text-slate">
          Hasil mission ada di{" "}
          <button
            type="button"
            onClick={onOpenMotherDashboard}
            className="font-medium text-violet-300 underline underline-offset-2"
          >
            Central dashboard
          </button>
          , Knowledge, dan Terminal — bukan di sini.
        </p>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {userMessages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/15 bg-white/5 px-3 py-2 text-xs text-slate">
            Tulis prompt lalu Run mission.
          </p>
        ) : (
          <ul className="space-y-2">
            {userMessages.slice(-6).map((message) => (
              <li
                key={message.id}
                className="ml-auto max-w-full rounded-xl border border-electric/25 bg-electric/10 px-3 py-2 text-sm text-white"
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 px-4 py-3">
        <label className="text-[11px] font-semibold text-slate" htmlFor="mission-input">
          Prompt
        </label>
        <textarea
          id="mission-input"
          rows={3}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Contoh: buat landing page crypto 1 halaman"
          className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-electric/60"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={busy || !prompt.trim()}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-electric px-3 py-2.5 text-sm font-semibold text-navy enabled:hover:brightness-110 disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden />
          Run mission
        </button>
        <p className="mt-1.5 text-[10px] text-slate">
          Status: <span className="text-electric">{status}</span>
          {busy ? " · Central Agent sedang jalan..." : ""}
        </p>
      </div>

      <div className="shrink-0 border-t border-white/10 px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {specialists.length > 1
            ? specialists.map((s, i) => (
                <button
                  key={`${s.name}-${i}`}
                  type="button"
                  onClick={() => onOpenAgentDashboard({ kind: "specialist", index: i })}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate hover:border-electric/40 hover:text-electric"
                >
                  {squadTabLabel(s, i)}
                </button>
              ))
            : (
              <button
                type="button"
                onClick={() => onOpenAgentDashboard({ kind: "specialist", index: 0 })}
                className="rounded-lg border border-electric/30 bg-electric/10 px-2 py-1 text-[10px] text-electric"
              >
                Dashboard · {profile.name}
              </button>
            )}
          {fleetSummary?.subAgentRuns?.length ? (
            <span className="text-[10px] text-slate">
              Fleet: {fleetSummary.subAgentRuns.filter((r) => r.source !== "skipped").length}/
              {fleetSummary.subAgentRuns.length} ok
            </span>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
