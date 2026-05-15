export type SpecialistAgentProfile = {
  name: string;
  role: string;
  purpose: string;
  systemInstructions: string;
  allowedTools: string[];
  outputFormat: string;
  apiKeyRefs: string[];
  notes: string;
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
