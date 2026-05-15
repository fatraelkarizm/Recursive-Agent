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
  canvasLane?: "frontend" | "backend" | "general";
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  at: number;
};

export type MissionRequest = {
  prompt: string;
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

export type MissionResponse = {
  missionId: string;
  profile: SpecialistAgentProfile;
  specialists?: SpecialistAgentProfile[];
  fleetSummary?: FleetOrchestrationSummary;
  status: "created" | "running" | "completed" | "failed";
  events?: string[];
};
