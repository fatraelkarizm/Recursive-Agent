"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { nanoid } from "nanoid";
import { ControlChatPanel } from "@/components/control-chat-panel";
import { TerminalDrawer } from "@/components/terminal-drawer";
import { VitalsPanel } from "@/components/vitals-panel";
import { WorkspaceRail, type WorkspaceRecipe } from "@/components/workspace-rail";
import { createMission } from "@/lib/api";
import { AgentDashboardModal, type AgentDashboardTarget } from "@/components/agent-dashboard-modal";
import {
  MotherAgentModal,
  emptyMotherMissionBundle,
  motherBundleToMissionExtras,
  type MotherMissionBundle
} from "@/components/mother-agent-modal";
import type { ChatMessage, FleetOrchestrationSummary, SpecialistAgentProfile } from "@/lib/types";

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
  /** Latest squad for canvas + tabs (defaults to single pending profile before first run). */
  const [squad, setSquad] = useState<SpecialistAgentProfile[]>([initialProfile]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fleetSummary, setFleetSummary] = useState<FleetOrchestrationSummary | null>(null);
  const [lastMissionPrompt, setLastMissionPrompt] = useState("");
  const [dashTarget, setDashTarget] = useState<AgentDashboardTarget | null>(null);
  const [motherBundle, setMotherBundle] = useState<MotherMissionBundle>(emptyMotherMissionBundle());
  const [motherModalOpen, setMotherModalOpen] = useState(false);

  function handleSelectRecipe(recipe: WorkspaceRecipe) {
    setSelectedRecipeId(recipe.id);
    setPrompt(recipe.prompt);
  }

  async function handleRunMission() {
    if (!prompt.trim()) return;
    setBusy(true);
    setStatus("running");
    const promptTrim = prompt.trim();
    setLastMissionPrompt(promptTrim);
    try {
      const result = await createMission({
        prompt: promptTrim,
        ...motherBundleToMissionExtras(motherBundle)
      });
      setProfile(result.profile);
      setSquad(result.specialists ?? [result.profile]);
      setFleetSummary(result.fleetSummary ?? null);
      setStatus(result.status);
      const lines = [
        `Mission ${result.missionId} → ${result.status}`,
        ...(result.events ?? []).map((event) => `• ${event}`)
      ];
      setMessages((current) => [
        ...current,
        {
          id: nanoid(),
          role: "assistant",
          content: lines.join("\n"),
          at: Date.now()
        }
      ]);
    } catch (error) {
      console.error(error);
      setStatus("failed");
      setFleetSummary(null);
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
      setBusy(false);
    }
  }

  return (
    <main className="flex h-screen min-h-[720px] flex-col bg-navy text-white">
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
      />
      <div className="flex min-h-0 flex-1">
        <WorkspaceRail selectedId={selectedRecipeId} onSelectRecipe={handleSelectRecipe} />

        <section className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:gap-4 sm:p-5">
          <MissionCanvas
            status={status}
            specialists={squad}
            onSelectAgent={(t) => setDashTarget(t)}
            onOpenMotherDashboard={() => setMotherModalOpen(true)}
          />
          <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-2">
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
