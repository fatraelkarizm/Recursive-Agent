"use client";

import { useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { Send } from "lucide-react";
import { SpecialistAgentPanel } from "@/components/specialist-agent-panel";
import type { ChatMessage } from "@/lib/types";
import type { SpecialistAgentProfile } from "@/lib/types";

type ControlChatPanelProps = {
  messages: ChatMessage[];
  onMessagesChange: (next: ChatMessage[]) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  status: string;
  profile: SpecialistAgentProfile;
  onRunMission: () => void;
  busy: boolean;
};

export function ControlChatPanel({
  messages,
  onMessagesChange,
  prompt,
  onPromptChange,
  status,
  profile,
  onRunMission,
  busy
}: ControlChatPanelProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

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
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-white/10 bg-black/30">
      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate">Control</p>
        <h2 className="text-base font-semibold text-white">Mission chat</h2>
        <p className="mt-1 text-xs text-slate">Steer the mother agent, launch a mission, and inspect the generated specialist.</p>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/15 bg-white/5 px-3 py-3 text-xs text-slate">
            Describe what you want the specialist to do. This panel mirrors a workflow “control room” chat on the right, while APIs and recipes stay on the left rail.
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
          placeholder="Example: Build a research specialist that cites Tavily results..."
          className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-electric/60"
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={busy || !prompt.trim()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-electric px-3 py-2 text-sm font-semibold text-navy transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden />
            Run mission
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate">Worker status: {status}</p>
      </div>

      <div className="border-t border-white/10 px-4 py-4">
        <SpecialistAgentPanel profile={profile} variant="embedded" />
      </div>
    </aside>
  );
}
