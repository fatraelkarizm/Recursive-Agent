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

export type MissionResponse = {
  missionId: string;
  profile: SpecialistAgentProfile;
  status: "created" | "running" | "completed" | "failed";
  events?: string[];
};
