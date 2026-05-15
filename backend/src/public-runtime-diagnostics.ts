/**
 * Safe, read-only snapshot of worker env for UI "Config" tab.
 * Never returns secret values — only presence + non-sensitive metadata.
 */

import { isAutoOrchestrationEnabled } from "./agent/specializations";

export type PublicRuntimeDiagnostics = {
  generatedAt: string;
  llmGateway: {
    openAiCompat: {
      configured: boolean;
      /** Origin + path prefix only; no query/credentials */
      baseUrlDisplay: string | null;
      model: string;
      timeoutMs: number;
      bearerFrom: "OPENAI_COMPAT_API_KEY" | "DEEPSEEK_API_KEY" | "none";
      bearerPresent: boolean;
    };
    openClaw: {
      orchestrationEnabled: boolean;
      orchestrationRaw: string | null;
      bin: string;
      agentId: string;
      model: string | null;
      useLocal: boolean;
      timeoutMs: number;
    };
  };
  tools: {
    tavilyApiKeyPresent: boolean;
    e2bApiKeyPresent: boolean;
  };
  persistence: {
    databaseUrlPresent: boolean;
  };
  fleet: {
    autoOrchestrationEnabled: boolean;
    maxTokensPerSub: number;
    mergeMaxTokens: number;
  };
  disclaimer: string;
};

function envTrim(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function safeBaseUrlDisplay(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  try {
    const u = new URL(s);
    const path = u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/$/, "") : "";
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return s.length > 96 ? `${s.slice(0, 93)}…` : s;
  }
}

function truthyEnv(name: string): boolean {
  return Boolean(envTrim(name));
}

export function getPublicRuntimeDiagnostics(): PublicRuntimeDiagnostics {
  const openAiCompatKey = envTrim("OPENAI_COMPAT_API_KEY");
  const deepseekKey = envTrim("DEEPSEEK_API_KEY");
  const bearerFrom = openAiCompatKey
    ? ("OPENAI_COMPAT_API_KEY" as const)
    : deepseekKey
      ? ("DEEPSEEK_API_KEY" as const)
      : ("none" as const);
  const bearerPresent = Boolean(openAiCompatKey || deepseekKey);
  const base = envTrim("OPENAI_COMPAT_BASE_URL");
  const configured = Boolean(base && bearerPresent);

  const orch = envTrim("OPENCLAW_ORCHESTRATION");
  const orchestrationEnabled = orch !== "0";

  const fleetMax = Number(process.env.FLEET_MAX_TOKENS_PER_SUB ?? "1400");
  const mergeMax = Number(process.env.FLEET_MERGE_MAX_TOKENS ?? "2200");

  return {
    generatedAt: new Date().toISOString(),
    llmGateway: {
      openAiCompat: {
        configured,
        baseUrlDisplay: safeBaseUrlDisplay(base),
        model: envTrim("OPENAI_COMPAT_MODEL") || "qwen3.6-plus",
        timeoutMs: Number(process.env.OPENAI_COMPAT_TIMEOUT_MS ?? "45000"),
        bearerFrom,
        bearerPresent
      },
      openClaw: {
        orchestrationEnabled,
        orchestrationRaw: orch ?? null,
        bin: envTrim("OPENCLAW_BIN") || "openclaw",
        agentId: envTrim("OPENCLAW_ORCHESTRATOR_AGENT") || "main",
        model: envTrim("OPENCLAW_MODEL") ?? null,
        useLocal: envTrim("OPENCLAW_USE_LOCAL") !== "0",
        timeoutMs: Number(process.env.OPENCLAW_TIMEOUT_MS ?? "120000")
      }
    },
    tools: {
      tavilyApiKeyPresent: truthyEnv("TAVILY_API_KEY"),
      e2bApiKeyPresent: truthyEnv("E2B_API_KEY")
    },
    persistence: {
      databaseUrlPresent: truthyEnv("DATABASE_URL")
    },
    fleet: {
      autoOrchestrationEnabled: isAutoOrchestrationEnabled(),
      maxTokensPerSub: Number.isFinite(fleetMax) && fleetMax > 200 ? fleetMax : 1400,
      mergeMaxTokens: Number.isFinite(mergeMax) && mergeMax > 400 ? mergeMax : 2200
    },
    disclaimer:
      "Nilai rahasia (API key) tidak pernah dikirim ke browser. Set variabel di backend/.env lalu restart worker."
  };
}
