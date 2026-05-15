import type { MissionPayload, SpecialistAgentProfile } from "../types";
import { stripMarkdownToPlainText } from "../util/plain-text";

/** Context pack injected into every OpenClaw sub-agent turn (skills + URLs + research + knowledge). Plain text only. */
export function buildOpenClawMissionContext(params: {
  payload: MissionPayload;
  effectivePrompt: string;
  webResearch: string;
  fleetLead: SpecialistAgentProfile;
  squad: SpecialistAgentProfile[];
  fleetMergedReport?: string;
  knowledgeDigest?: string;
}): string {
  const urls = (params.payload.referenceUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, 12);

  const urlBlock = urls.length
    ? urls.map((u) => u).join("\n")
    : "Tidak ada URL eksternal. Gunakan riset Tavily di bawah.";

  const specialistSkills = params.squad
    .map((s) => {
      const block = s.skillMd?.trim() || s.skills.map((sk) => `${sk.label}. ${sk.description}`).join("\n");
      return `Specialist ${s.name} role ${s.role} lane ${s.canvasLane ?? "general"}\n${block}`;
    })
    .join("\n\n");

  const subBlocks = (params.fleetLead.subAgents ?? [])
    .map((sub) => {
      const skill = sub.skillMd?.trim() || sub.focus;
      return `Sub-agent ${sub.id} role ${sub.role}\nFokus ${sub.focus}\nSKILL\n${skill}`;
    })
    .join("\n\n");

  const parts = [
    "External URLs prioritas",
    urlBlock,
    "",
    "SKILL per specialist",
    specialistSkills,
    "",
    "SKILL per sub-agent sesuai role",
    subBlocks || "Tidak ada sub-agent.",
    "",
    "Lead specialist",
    `${params.fleetLead.name} role ${params.fleetLead.role}`,
    params.fleetLead.purpose,
    "",
    "Web research Tavily",
    params.webResearch.trim().slice(0, 8000) || "kosong",
    "",
    "User mission",
    params.effectivePrompt.trim().slice(0, 4000)
  ];

  if (params.payload.contextNotes?.trim()) {
    parts.push("", "Extra context dari Central Agent bundle", params.payload.contextNotes.trim().slice(0, 4000));
  }

  if (params.knowledgeDigest?.trim()) {
    parts.push("", "Real-time knowledge digest (SKILL.md, docs, best practices dari web)", params.knowledgeDigest.trim().slice(0, 5000));
  }

  if (params.fleetMergedReport?.trim()) {
    parts.push("", "Prior fleet output", params.fleetMergedReport.trim().slice(0, 6000));
  }

  return stripMarkdownToPlainText(parts.join("\n"));
}
