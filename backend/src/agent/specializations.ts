import { nanoid } from "nanoid";
import type { SubAgentDescriptor } from "../types";

const URL_RE = /https?:\/\/[^\s<>"')]+/i;

/**
 * When enabled (default), every mission gets fleet-style orchestration (sub-agents + sequential run)
 * without requiring keywords like "openclaw" or "fleet" in the prompt.
 * Set `AUTO_ORCHESTRATION=0` to only orchestrate when the user mentions orchestration explicitly.
 */
export function isAutoOrchestrationEnabled(): boolean {
  const v = process.env.AUTO_ORCHESTRATION?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return false;
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
