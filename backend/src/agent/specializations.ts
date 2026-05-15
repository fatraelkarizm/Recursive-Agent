import { nanoid } from "nanoid";
import type { SubAgentDescriptor } from "../types";

const URL_RE = /https?:\/\/[^\s<>"')]+/i;

/**
 * When enabled (default), every mission gets fleet-style orchestration (sub-agents + sequential run)
 * without requiring keywords like "openclaw" or "fleet" in the prompt.
 * Set `AUTO_ORCHESTRATION=0` to only orchestrate when the user mentions orchestration explicitly.
 */
/** Default ON — set `AUTO_ORCHESTRATION=0` to disable automatic fleet + OpenClaw. */
export function isAutoOrchestrationEnabled(): boolean {
  const v = process.env.AUTO_ORCHESTRATION?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
}

export function isOpenClawOrchestrationEnabled(): boolean {
  return process.env.OPENCLAW_ORCHESTRATION?.trim() !== "0";
}

/** Lead specialist must have sub-agents + OpenClaw mode for automatic fleet runs. */
export function ensureLeadFleetReady(lead: SpecialistAgentProfile, missionPrompt: string): void {
  if (!isAutoOrchestrationEnabled()) return;

  lead.orchestrationMode = "openclaw";
  const specs = new Set(lead.specializations.filter((s) => s !== "core-mission"));
  specs.add("openclaw-orchestration");
  lead.specializations = [...specs];

  const tools = new Set(lead.allowedTools);
  tools.add("openclaw-orchestrator");
  tools.add("tavily-search");
  lead.allowedTools = [...tools];

  if (!lead.subAgents?.length) {
    lead.subAgents = buildMissionSubAgents(missionPrompt, lead.role);
  }
}

/** Sub-agents tuned to mission type (landing/crypto vs generic). */
export function buildMissionSubAgents(prompt: string, role: string): SubAgentDescriptor[] {
  const p = prompt.toLowerCase();
  const base = prompt.trim().slice(0, 160) || "Execute the user mission";

  if (/(landing|crypto|html|halaman|homepage|ui|css|website)/i.test(p)) {
    return [
      {
        id: `sub-${nanoid(6)}`,
        role: `${role}-scout`,
        focus: "Riset referensi desain UI/UX, tren warna, typography, dan kompetitor (gunakan konteks Tavily)."
      },
      {
        id: `sub-${nanoid(6)}`,
        role: `${role}-worker`,
        focus: "Susun struktur halaman, copy hero/CTA, dan spesifikasi komponen HTML/CSS."
      },
      {
        id: `sub-${nanoid(6)}`,
        role: `${role}-reviewer`,
        focus: "Review deliverable vs misi user; pastikan ada HTML/CSS siap preview bila diminta."
      }
    ];
  }

  return buildSubAgents(prompt, role);
}

export function inferSpecializations(prompt: string): string[] {
  const p = prompt.toLowerCase();
  const out = new Set<string>();
  if (
    /browser|playwright|puppeteer|selenium|headless|navigate|click\b|web ui|website|localhost:\d+|https?:\/\//.test(
      p
    )
  ) {
    out.add("browser-automation");
  }
  if (
    isAutoOrchestrationEnabled() ||
    /openclaw|open.?claw|orchestrat|multi.?agent|delegat|sub.?agent|fleet|swarm/.test(p)
  ) {
    out.add("openclaw-orchestration");
  }
  if (out.size === 0) {
    out.add("core-mission");
  }
  return [...out];
}

export function pickOrchestrationMode(prompt: string): "local" | "openclaw" {
  if (isAutoOrchestrationEnabled()) {
    return "openclaw";
  }
  const p = prompt.toLowerCase();
  if (/openclaw|orchestrat|multi.?agent|delegat|sub.?agent|fleet|swarm/.test(p)) {
    return "openclaw";
  }
  return "local";
}

export function buildSubAgents(prompt: string, role: string): SubAgentDescriptor[] {
  const base = prompt.trim().slice(0, 160) || "Execute the user mission";
  return [
    {
      id: `sub-${nanoid(6)}`,
      role: `${role}-scout`,
      focus: `Clarify goal and constraints from: ${base}`
    },
    {
      id: `sub-${nanoid(6)}`,
      role: `${role}-worker`,
      focus: "Execute scoped actions and return structured results"
    },
    {
      id: `sub-${nanoid(6)}`,
      role: `${role}-reviewer`,
      focus: "Check outputs against the original mission before handoff"
    }
  ];
}

export function extractFirstUrl(prompt: string): string | null {
  const m = prompt.match(URL_RE);
  return m ? m[0].replace(/[.,;]+$/, "") : null;
}
