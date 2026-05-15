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

export type MissionPayload = {
  prompt: string;
};

export type MissionResult = {
  missionId: string;
  status: "created" | "running" | "completed" | "failed";
  profile: SpecialistAgentProfile;
  events: string[];
};
