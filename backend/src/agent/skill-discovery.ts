import { tavily } from "@tavily/core";
import { nanoid } from "nanoid";
import type { SpecialistSkill, SubAgentDescriptor } from "../types";
import { stripMarkdownToPlainText } from "../util/plain-text";
import { logger } from "../logging";

function slugId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function parseSkillsFromSearchText(raw: string, source: string): SpecialistSkill[] {
  const skills: SpecialistSkill[] = [];
  const seen = new Set<string>();

  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const cleaned = stripMarkdownToPlainText(line);
    if (cleaned.length < 12 || cleaned.length > 220) continue;
    if (/^sumber|^ringkasan|^http/i.test(cleaned)) continue;

    const id = slugId(cleaned) || `skill-${nanoid(4)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const kind: SpecialistSkill["kind"] =
      /riset|search|extract|browse|tavily|url/i.test(cleaned)
        ? "touch"
        : /orchestr|fleet|openclaw|delegate/i.test(cleaned)
          ? "orchestrate"
          : /html|css|ui|api|code|build|generate/i.test(cleaned)
            ? "generate"
            : "other";

    skills.push({
      id,
      label: cleaned.slice(0, 80),
      description: `${cleaned.slice(0, 200)} (sumber: ${source})`,
      kind
    });
    if (skills.length >= 24) break;
  }

  return skills;
}

async function tavilySearch(query: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return "";

  const client = tavily({ apiKey: key });
  try {
    const res = await client.search(query.slice(0, 400), {
      maxResults: 6,
      searchDepth: "advanced",
      includeAnswer: true
    });
    const parts: string[] = [];
    if (res.answer) parts.push(stripMarkdownToPlainText(res.answer));
    for (const r of res.results) {
      parts.push(
        stripMarkdownToPlainText(`${r.title}. ${(r.content ?? "").slice(0, 200)}. ${r.url}`)
      );
    }
    return parts.filter(Boolean).join("\n");
  } catch (err) {
    logger.warn({ err, query }, "Skill discovery search failed");
    return "";
  }
}

function roleBucket(role: string): "scout" | "worker" | "reviewer" | "frontend" | "backend" | "general" {
  const r = role.toLowerCase();
  if (r.includes("scout")) return "scout";
  if (r.includes("reviewer")) return "reviewer";
  if (r.includes("worker")) return "worker";
  if (r.includes("frontend") || r.includes("nextjs") || r.includes("ui")) return "frontend";
  if (r.includes("backend") || r.includes("api")) return "backend";
  return "general";
}

function pickSkillsForBucket(catalog: SpecialistSkill[], bucket: string, limit = 8): SpecialistSkill[] {
  const scored = catalog.map((s) => {
    const text = `${s.label} ${s.description}`.toLowerCase();
    let score = 0;
    if (bucket === "scout" && /riset|research|trend|referensi|browse|extract|ui|ux|competitor/.test(text)) {
      score += 3;
    }
    if (bucket === "worker" && /build|html|css|ui|api|implement|copy|component|generate/.test(text)) {
      score += 3;
    }
    if (bucket === "reviewer" && /review|quality|test|audit|check|deliverable|preview/.test(text)) {
      score += 3;
    }
    if (bucket === "frontend" && /frontend|html|css|react|next|ui|landing/.test(text)) score += 2;
    if (bucket === "backend" && /backend|api|rest|database|prisma|server/.test(text)) score += 2;
    return { s, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

export type SkillDiscoveryResult = {
  catalog: SpecialistSkill[];
  researchNotes: string;
};

/** Tavily + OpenClaw-oriented queries to find many SKILL.md / agent skill patterns on the web. */
export async function discoverSkillsForMission(missionPrompt: string): Promise<SkillDiscoveryResult> {
  const topic = missionPrompt.trim().slice(0, 120);
  const queries = [
    `cursor agent SKILL.md ${topic}`,
    `openclaw agent skills sub-agent ${topic}`,
    `${topic} frontend developer skills checklist landing page`,
    `${topic} backend API skills best practices`,
    "recursive agent specialist skills markdown playbook"
  ];

  const chunks: string[] = [];
  const catalog: SpecialistSkill[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    const text = await tavilySearch(q);
    if (!text) continue;
    chunks.push(`Query: ${q}\n${text}`);
    for (const sk of parseSkillsFromSearchText(text, q)) {
      if (seen.has(sk.id)) continue;
      seen.add(sk.id);
      catalog.push(sk);
    }
  }

  return {
    catalog,
    researchNotes: chunks.join("\n\n").slice(0, 12000)
  };
}

export function mergeSkills(base: SpecialistSkill[], extra: SpecialistSkill[]): SpecialistSkill[] {
  const out = [...base];
  const ids = new Set(base.map((s) => s.id));
  for (const s of extra) {
    if (!ids.has(s.id)) {
      out.push(s);
      ids.add(s.id);
    }
  }
  return out;
}

export function buildSubAgentSkillMd(
  sub: SubAgentDescriptor,
  skills: SpecialistSkill[],
  missionPrompt: string
): string {
  const lines = [
    `SKILL untuk sub-agent ${sub.role}`,
    "",
    "Fokus",
    sub.focus,
    "",
    "Misi",
    stripMarkdownToPlainText(missionPrompt.slice(0, 800)),
    "",
    "Skills (dari Tavily + Central Agent, sesuai peran)",
    ...skills.map((s) => `${s.label}. ${s.description}`)
  ];
  return stripMarkdownToPlainText(lines.join("\n"));
}

export function enrichSubAgentsWithDiscoveredSkills(
  subs: SubAgentDescriptor[],
  catalog: SpecialistSkill[],
  missionPrompt: string
): SubAgentDescriptor[] {
  return subs.map((sub) => {
    const bucket = roleBucket(sub.role);
    const picked = pickSkillsForBucket(catalog, bucket, 10);
    return {
      ...sub,
      skillMd: buildSubAgentSkillMd(sub, picked, missionPrompt)
    };
  });
}

export function enrichSquadWithDiscoveredSkills(
  squad: import("../types").SpecialistAgentProfile[],
  catalog: SpecialistSkill[]
): void {
  for (const agent of squad) {
    const lane = agent.canvasLane ?? "general";
    const bucket = lane === "frontend" ? "frontend" : lane === "backend" ? "backend" : "general";
    const picked = pickSkillsForBucket(catalog, bucket, 12);
    agent.skills = mergeSkills(agent.skills, picked);
  }
}
