export type SubAgentDescriptor = {
  id: string;
  role: string;
  focus: string;
};

export type SpecialistSkill = {
  id: string;
  label: string;
  description: string;
  kind: "touch" | "generate" | "orchestrate" | "other";
  instructions?: string;
};

export type SpecialistAgentProfile = {
  name: string;
  role: string;
  purpose: string;
  systemInstructions: string;
  allowedTools: string[];
  outputFormat: string;
  apiKeyRefs: string[];
  notes: string;
  specializations: string[];
  orchestrationMode: "local" | "openclaw";
  subAgents?: SubAgentDescriptor[];
  skills: SpecialistSkill[];
  readmeMd: string;
  skillMd?: string;
  canvasPosition?: { x: number; y: number };
  canvasLane?: "frontend" | "backend" | "general";
  persistedId?: string;
  missionId?: string;
};

export type StoredCanvasAgent = {
  id: string;
  missionId: string | null;
  createdAt: string;
  profile: SpecialistAgentProfile;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  at: number;
};

export type MissionRequest = {
  prompt: string;
  contextNotes?: string;
  referenceUrls?: string[];
  preferTavilySearch?: boolean;
  motherReviewNotes?: string;
};

export type SubAgentRunResult = {
  id: string;
  role: string;
  focus: string;
  output: string;
  source: "openai-compat" | "openclaw" | "skipped";
};

export type FleetOrchestrationSummary = {
  mergedReport: string;
  subAgentRuns: SubAgentRunResult[];
};

export type MotherPhase =
  | "mother-planning"
  | "mother-spawn"
  | "mother-review"
  | "specialist-readme"
  | "fleet-run"
  | "fleet-merge"
  | "tools"
  | "persist"
  | "done"
  | "error";

export type MissionProgressEvent = {
  phase: MotherPhase;
  label: string;
  detail?: string;
  at: string;
};

export type MissionResponse = {
  missionId: string;
  profile: SpecialistAgentProfile;
  specialists?: SpecialistAgentProfile[];
  fleetSummary?: FleetOrchestrationSummary;
  motherBrief?: string;
  squadSource?: "mother-llm" | "fallback-rules";
  motherReview?: string;
  centralSkillMd?: string;
  centralReadmeMd?: string;
  status: "created" | "running" | "completed" | "failed";
  events?: string[];
};

/** GET /api/runtime-config — safe worker snapshot (no secret values). */
export type PublicRuntimeDiagnostics = {
  generatedAt: string;
  llmGateway: {
    openAiCompat: {
      configured: boolean;
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
