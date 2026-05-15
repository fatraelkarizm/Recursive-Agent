import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SpecialistAgentProfile } from "../types";
import { logger } from "../logging";

const execFileAsync = promisify(execFile);

function buildOrchestrationMessage(
  missionId: string,
  motherPrompt: string,
  profile: SpecialistAgentProfile
): string {
  const subs = (profile.subAgents ?? [])
    .map((s) => `- ${s.id} (${s.role}): ${s.focus}`)
    .join("\n");

  const skills = (profile.skills ?? [])
    .map((s) => `- ${s.label} [${s.kind}]: ${s.description}`)
    .join("\n");

  return [
    "You are the Recursive Agent OpenClaw orchestrator.",
    `Mission id: ${missionId}`,
    `User mission:\n${motherPrompt}`,
    "",
    `Lead specialist: ${profile.name} (${profile.role})`,
    `Purpose: ${profile.purpose}`,
    `Allowed tools: ${profile.allowedTools.join(", ")}`,
    "",
    "Specialist skills (honor these boundaries):",
    skills || "- (none)",
    "",
    "Sub-agents to coordinate (assign order, merge outputs, stop on failure):",
    subs || "- (none listed)",
    "",
    "Reply with a short orchestration plan (steps + which sub-agent owns each step).",
    "Do not claim you executed browser or network actions unless tools did."
  ].join("\n");
}

export async function runOpenClawAgentMessage(params: { message: string; sessionId: string }): Promise<string> {
  if (process.env.OPENCLAW_ORCHESTRATION === "0") {
    return "openclaw: skipped (OPENCLAW_ORCHESTRATION=0).";
  }

  const bin = process.env.OPENCLAW_BIN ?? "openclaw";
  const agentId = process.env.OPENCLAW_ORCHESTRATOR_AGENT ?? "main";
  const useLocal = process.env.OPENCLAW_USE_LOCAL !== "0";

  const args = [
    "agent",
    "--session-id",
    params.sessionId,
    "--agent",
    agentId,
    "--message",
    params.message,
    "--json"
  ];
  // OpenClaw 2026.4.x CLI has no `--model` flag on `agent`; set default model in
  // ~/.openclaw/openclaw.json (or use OPENCLAW_MODEL only as documentation / future versions).
  const model = process.env.OPENCLAW_MODEL?.trim();
  if (model?.startsWith("deepseek/") && !process.env.DEEPSEEK_API_KEY?.trim()) {
    logger.warn(
      { OPENCLAW_MODEL: model },
      "DEEPSEEK_API_KEY missing in backend env — OpenClaw may fall back to another provider (e.g. zai). Set it in backend/.env."
    );
  }
  if (useLocal) {
    args.push("--local");
  }

  const configuredTimeout = Number(process.env.OPENCLAW_TIMEOUT_MS ?? "60000");
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 1000 ? configuredTimeout : 60000;

  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout: timeoutMs,
      maxBuffer: 12 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env }
    });
    const tail = stderr.trim() ? `\nstderr (trimmed): ${stderr.trim().slice(0, 2000)}` : "";
    return `openclaw: ${stdout.trim().slice(0, 8000)}${tail}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `openclaw: CLI not available or run failed (${msg}). Install OpenClaw, ensure 'openclaw agent' works, and see docs/OPENCLAW_INTEGRATION.md.`;
  }
}

/**
 * Delegates one orchestration turn to the OpenClaw CLI (embedded/local by default).
 * Requires `openclaw` on PATH and a working local plugin setup for `--local`.
 */
export async function orchestrateViaOpenClaw(params: {
  missionId: string;
  motherPrompt: string;
  profile: SpecialistAgentProfile;
}): Promise<string> {
  if (process.env.OPENCLAW_ORCHESTRATION === "0") {
    return "OpenClaw orchestration skipped (OPENCLAW_ORCHESTRATION=0).";
  }

  const sessionId =
    process.env.OPENCLAW_SESSION_PREFIX != null
      ? `${process.env.OPENCLAW_SESSION_PREFIX}-${params.missionId}`
      : `recursive-agent-${params.missionId}`;

  const message = buildOrchestrationMessage(params.missionId, params.motherPrompt, params.profile);
  return runOpenClawAgentMessage({ message, sessionId });
}

export function shouldRunOpenClaw(profile: SpecialistAgentProfile): boolean {
  return (
    profile.orchestrationMode === "openclaw" ||
    profile.specializations.includes("openclaw-orchestration")
  );
}
