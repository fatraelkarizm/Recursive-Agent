"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ControlChatPanel } from "@/components/control-chat-panel";
import { KnowledgePanel } from "@/components/knowledge-panel";
import { TerminalDrawer } from "@/components/terminal-drawer";
import { VitalsPanel } from "@/components/vitals-panel";
import { WorkspaceRail } from "@/components/workspace-rail";
import { AgentDashboardModal, type AgentDashboardTarget } from "@/components/agent-dashboard-modal";
import {
  MotherAgentModal,
  emptyMotherMissionBundle,
  motherBundleToMissionExtras,
  type MotherMissionBundle
} from "@/components/mother-agent-modal";
import { clearCanvasAgents, deleteCanvasAgent, fetchCanvasAgents } from "@/lib/api";
import { mergeCanvasAgents, isPlaceholderAgent } from "@/lib/canvas-agents";
import {
  loadCanvasViewMode,
  loadHiddenAgentIds,
  saveCanvasViewMode,
  saveHiddenAgentIds,
  type CanvasViewMode
} from "@/lib/canvas-agent-prefs";
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
  const [canvasViewMode, setCanvasViewMode] = useState<CanvasViewMode>(() => loadCanvasViewMode());
  const [hiddenAgentIds, setHiddenAgentIds] = useState<Set<string>>(() => loadHiddenAgentIds());
  const [agentsBusy, setAgentsBusy] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      const rows = await fetchCanvasAgents();
      if (rows.length === 0) {
        setSquad([initialProfile]);
        return;
      }
      const profiles = rows.map((r) => r.profile);
      setSquad(profiles);
      const latest = rows[rows.length - 1];
      if (latest?.missionId) {
        setActiveMissionId(latest.missionId);
      }
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

  async function handleRunMission() {
    if (!prompt.trim() || busy) return;

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

            // Hasil mission -> Knowledge / Terminal / Central dashboard (bukan chat assistant yang menutupi UI).
          },
          onError: (message) => {
            setStatus("failed");
            console.error(message);
          }
        }
      );
    } catch (error) {
      console.error(error);
      setStatus("failed");
      console.error(
        "Mission failed before reaching the worker. Start backend and check NEXT_PUBLIC_BACKEND_URL."
      );
    } finally {
      setBusy(false);
      setProgressCurrent(null);
    }
  }

  const canvasAgents = squad.filter((a) => !isPlaceholderAgent(a));

  const visibleCanvasAgents = useMemo(() => {
    let list = canvasAgents.filter((a) => !hiddenAgentIds.has(a.persistedId ?? ""));
    if (canvasViewMode === "latest-mission" && activeMissionId) {
      list = list.filter((a) => a.missionId === activeMissionId);
    }
    return list;
  }, [canvasAgents, hiddenAgentIds, canvasViewMode, activeMissionId]);

  const handleCanvasViewMode = useCallback((mode: CanvasViewMode) => {
    setCanvasViewMode(mode);
    saveCanvasViewMode(mode);
  }, []);

  const handleToggleHidden = useCallback((id: string) => {
    setHiddenAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveHiddenAgentIds(next);
      return next;
    });
  }, []);

  const handleDeleteAgent = useCallback(
    async (id: string) => {
      setAgentsBusy(true);
      try {
        await deleteCanvasAgent(id);
        setSquad((prev) => prev.filter((a) => a.persistedId !== id));
        setHiddenAgentIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          saveHiddenAgentIds(next);
          return next;
        });
      } catch (e) {
        console.error(e);
      } finally {
        setAgentsBusy(false);
      }
    },
    []
  );

  const handleKeepLatestMission = useCallback(async () => {
    if (!activeMissionId) return;
    setAgentsBusy(true);
    try {
      await clearCanvasAgents(activeMissionId);
      setSquad((prev) => prev.filter((a) => !a.persistedId || a.missionId === activeMissionId));
    } catch (e) {
      console.error(e);
    } finally {
      setAgentsBusy(false);
    }
  }, [activeMissionId]);

  const handleClearAllAgents = useCallback(async () => {
    if (!window.confirm("Hapus semua agent dari database?")) return;
    setAgentsBusy(true);
    try {
      await clearCanvasAgents();
      setSquad([initialProfile]);
      setHiddenAgentIds(new Set());
      saveHiddenAgentIds(new Set());
    } catch (e) {
      console.error(e);
    } finally {
      setAgentsBusy(false);
    }
  }, []);

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
        activeMissionId={activeMissionId}
        canvasViewMode={canvasViewMode}
        onCanvasViewModeChange={handleCanvasViewMode}
        hiddenAgentIds={hiddenAgentIds}
        onToggleHiddenAgent={handleToggleHidden}
        onDeleteAgent={handleDeleteAgent}
        onKeepLatestMissionAgents={handleKeepLatestMission}
        onClearAllAgents={handleClearAllAgents}
        agentsBusy={agentsBusy}
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
        <WorkspaceRail />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-4 sm:gap-3 sm:p-5">
          <div className="flex min-h-0 flex-[1] flex-col">
          {!agentsLoaded ? (
            <div className="flex min-h-[min(60vh,520px)] flex-1 items-center justify-center rounded-xl border border-white/10 text-sm text-slate">
              Memuat agent dari database…
            </div>
          ) : (
            <MissionCanvas
              status={status}
              specialists={visibleCanvasAgents.length > 0 ? visibleCanvasAgents : squad}
              activeMissionId={activeMissionId}
              onSelectAgent={(t) => setDashTarget(t)}
              onOpenMotherDashboard={() => setMotherModalOpen(true)}
              motherThinking={busy}
              motherProgressCurrent={progressCurrent}
              motherProgressHistory={progress}
            />
          )}
          </div>
          <div className="grid max-h-[min(28vh,240px)] shrink-0 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-3">
            <KnowledgePanel
              bundle={motherBundle}
              motherBrief={motherBrief}
              motherReview={motherReview}
              squadSource={squadSource}
              progress={progress}
              agentCount={visibleCanvasAgents.length}
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
