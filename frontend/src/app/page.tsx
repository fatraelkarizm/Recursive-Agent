"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { AppHeader } from "@/components/app-header";
import { ControlChatPanel } from "@/components/control-chat-panel";
import { KnowledgePanel } from "@/components/knowledge-panel";
import { TerminalDrawer } from "@/components/terminal-drawer";
import { VitalsPanel } from "@/components/vitals-panel";
import { WorkspaceRail, type WorkspaceRecipe } from "@/components/workspace-rail";
import { AgentDashboardModal, type AgentDashboardTarget } from "@/components/agent-dashboard-modal";
import {
  MotherAgentModal,
  emptyMotherMissionBundle,
  motherBundleToMissionExtras,
  type MotherMissionBundle
} from "@/components/mother-agent-modal";
import { fetchCanvasAgents } from "@/lib/api";
import { mergeCanvasAgents, isPlaceholderAgent } from "@/lib/canvas-agents";
import { createMissionStream } from "@/lib/mission-stream";
import type {
  ChatMessage,
  FleetOrchestrationSummary,
  MissionProgressEvent,
  SpecialistAgentProfile
} from "@/lib/types";

const MissionCanvas = dynamic(
  () => import("@/components/mission-canvas").then((mod) => ({ default: mod.MissionCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] flex-1 items-center justify-center rounded-xl border border-white/10 bg-slate-950/50 text-sm text-slate">
        Loading mission canvas…
      </div>
    )
  }
);

const initialProfile: SpecialistAgentProfile = {
  name: "Pending Agent",
  role: "pending",
  purpose: "Run a focused mission based on user chat",
  systemInstructions: "",
  allowedTools: [],
  outputFormat: "markdown",
  apiKeyRefs: [],
  notes: "",
  specializations: ["core-mission"],
  orchestrationMode: "local",
  skills: [],
  readmeMd: "",
  canvasLane: "general"
};

export default function Page() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("idle");
  const [profile, setProfile] = useState<SpecialistAgentProfile>(initialProfile);
  const [squad, setSquad] = useState<SpecialistAgentProfile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fleetSummary, setFleetSummary] = useState<FleetOrchestrationSummary | null>(null);
  const [lastMissionPrompt, setLastMissionPrompt] = useState("");
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [dashTarget, setDashTarget] = useState<AgentDashboardTarget | null>(null);
  const [motherBundle, setMotherBundle] = useState<MotherMissionBundle>(emptyMotherMissionBundle());
  const [motherModalOpen, setMotherModalOpen] = useState(false);
  const [motherBrief, setMotherBrief] = useState<string | null>(null);
  const [motherReview, setMotherReview] = useState<string | null>(null);
  const [squadSource, setSquadSource] = useState<string | null>(null);
  const [progress, setProgress] = useState<MissionProgressEvent[]>([]);
  const [progressCurrent, setProgressCurrent] = useState<MissionProgressEvent | null>(null);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const rows = await fetchCanvasAgents();
      if (rows.length === 0) {
        setSquad([initialProfile]);
        return;
      }
      setSquad(rows.map((r) => r.profile));
    } catch {
      setSquad([initialProfile]);
    } finally {
      setAgentsLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (!cancelled) void loadAgents();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [loadAgents]);

  useEffect(() => {
    const lead = squad.find((s) => !isPlaceholderAgent(s)) ?? squad[0];
    if (!lead || isPlaceholderAgent(lead)) return;
    const id = requestAnimationFrame(() => setProfile(lead));
    return () => cancelAnimationFrame(id);
  }, [squad]);

  function handleSelectRecipe(recipe: WorkspaceRecipe) {
    setSelectedRecipeId(recipe.id);
    setPrompt(recipe.prompt);
  }

  async function handleRunMission() {
    if (!prompt.trim() || busy) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setBusy(true);
    setStatus("running");
    setProgress([]);
    setProgressCurrent(null);
    const promptTrim = prompt.trim();
    setLastMissionPrompt(promptTrim);

    try {
      await createMissionStream(
        {
          prompt: promptTrim,
          ...motherBundleToMissionExtras(motherBundle)
        },
        {
          signal: ac.signal,
          onProgress: (event) => {
            setProgressCurrent(event);
            setProgress((prev) => [...prev, event]);
          },
          onDone: (result) => {
            const incoming = result.specialists ?? [result.profile];
            setSquad((prev) => mergeCanvasAgents(prev, incoming));
            setFleetSummary(result.fleetSummary ?? null);
            setActiveMissionId(result.missionId);
            setMotherBrief(result.motherBrief ?? null);
            setMotherReview(result.motherReview ?? null);
            setSquadSource(result.squadSource ?? null);
            setStatus(result.status);

            const lines = [
              `Mission ${result.missionId} → ${result.status}`,
              result.motherBrief ? `Mother: ${result.motherBrief.slice(0, 200)}…` : null,
              result.motherReview ? `Review: ${result.motherReview.slice(0, 160)}…` : null,
              ...(result.events ?? []).map((event) => `• ${event}`)
            ].filter(Boolean);
            setMessages((current) => [
              ...current,
              {
                id: nanoid(),
                role: "assistant",
                content: lines.join("\n"),
                at: Date.now()
              }
            ]);
          },
          onError: (message) => {
            if (ac.signal.aborted) return;
            setStatus("failed");
            setMessages((current) => [
              ...current,
              { id: nanoid(), role: "assistant", content: message, at: Date.now() }
            ]);
          }
        }
      );
    } catch (error) {
      if (ac.signal.aborted) return;
      console.error(error);
      setStatus("failed");
      setMessages((current) => [
        ...current,
        {
          id: nanoid(),
          role: "assistant",
          content:
            "Mission failed before reaching the worker. Start the backend (`cd backend && npm run dev`) and confirm `NEXT_PUBLIC_BACKEND_URL` points to it.",
          at: Date.now()
        }
      ]);
    } finally {
      if (!ac.signal.aborted) {
        setBusy(false);
        setProgressCurrent(null);
      }
    }
  }

  const canvasAgents = squad.filter((a) => !isPlaceholderAgent(a));

  return (
    <main className="flex h-screen min-h-[720px] flex-col bg-navy text-white">
      <AppHeader status={status} squadSource={squadSource} />
      <MotherAgentModal
        open={motherModalOpen}
        onClose={() => setMotherModalOpen(false)}
        bundle={motherBundle}
        onApply={setMotherBundle}
        missionPrompt={prompt}
        specialists={squad}
        fleetSummary={fleetSummary}
      />
      <AgentDashboardModal
        open={dashTarget !== null}
        onClose={() => setDashTarget(null)}
        target={dashTarget}
        missionPrompt={lastMissionPrompt}
        specialists={squad}
        fleetSummary={fleetSummary}
        activeMissionId={activeMissionId}
      />
      <div className="flex min-h-0 flex-1">
        <WorkspaceRail selectedId={selectedRecipeId} onSelectRecipe={handleSelectRecipe} />

        <section className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:gap-4 sm:p-5">
          {!agentsLoaded ? (
            <div className="flex min-h-[420px] flex-1 items-center justify-center rounded-xl border border-white/10 text-sm text-slate">
              Memuat agent dari database…
            </div>
          ) : (
            <MissionCanvas
              status={status}
              specialists={canvasAgents.length > 0 ? canvasAgents : squad}
              activeMissionId={activeMissionId}
              onSelectAgent={(t) => setDashTarget(t)}
              onOpenMotherDashboard={() => setMotherModalOpen(true)}
              motherThinking={busy}
              motherProgressCurrent={progressCurrent}
              motherProgressHistory={progress}
            />
          )}
          <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-3">
            <KnowledgePanel
              bundle={motherBundle}
              motherBrief={motherBrief}
              motherReview={motherReview}
              squadSource={squadSource}
              progress={progress}
              agentCount={canvasAgents.length}
            />
            <VitalsPanel status={status} />
            <TerminalDrawer events={messages.filter((m) => m.role === "assistant").slice(-1)} />
          </div>
        </section>

        <ControlChatPanel
          messages={messages}
          onMessagesChange={setMessages}
          prompt={prompt}
          onPromptChange={setPrompt}
          status={status}
          profile={profile}
          specialists={squad}
          fleetSummary={fleetSummary}
          onOpenAgentDashboard={(t) => setDashTarget(t)}
          onOpenMotherDashboard={() => setMotherModalOpen(true)}
          onRunMission={handleRunMission}
          busy={busy}
        />
      </div>
    </main>
  );
}
