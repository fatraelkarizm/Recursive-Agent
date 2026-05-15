import { tavily } from "@tavily/core";
import { nanoid } from "nanoid";
import type { SpecialistSkill, SubAgentDescriptor } from "../types";
import { stripMarkdownToPlainText } from "../util/plain-text";
import { extractSkillsFromWeb, type ExtractedSkillDoc } from "./skill-extractor";
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

    const kind = classifySkillKind(cleaned);

    skills.push({
      id,
      label: cleaned.slice(0, 80),
      description: `${cleaned.slice(0, 200)} (sumber: ${source})`,
      kind,
    });
    if (skills.length >= 30) break;
  }

  return skills;
}

function classifySkillKind(text: string): SpecialistSkill["kind"] {
  const t = text.toLowerCase();
  if (/riset|search|extract|browse|tavily|url|crawl|scrape|fetch|monitor/i.test(t)) return "touch";
  if (/orchestr|fleet|openclaw|delegate|coordinate|pipeline|workflow/i.test(t)) return "orchestrate";
  if (/html|css|ui|api|code|build|generate|create|deploy|implement|write|develop/i.test(t)) return "generate";
  return "other";
}

/** Parse extracted doc content into structured skills. */
function parseSkillsFromDoc(doc: ExtractedSkillDoc): SpecialistSkill[] {
  const skills: SpecialistSkill[] = [];
  const seen = new Set<string>();
  const content = doc.content;

  const sectionPatterns = [
    /(?:^|\n)(?:Skills?|Capabilities?|Features?|Tools?|What (?:it|this) (?:can )?do(?:es)?)[:\s]*\n([\s\S]*?)(?=\n(?:#{1,3}\s|$))/gi,
    /(?:^|\n)(?:Kapan memakai|When to use|Use (?:this|when))[:\s]*\n([\s\S]*?)(?=\n(?:#{1,3}\s|$))/gi,
    /(?:^|\n)-\s+(.+)/gm,
  ];

  for (const pattern of sectionPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const text = stripMarkdownToPlainText(match[1] ?? match[0]).trim();
      if (text.length < 10 || text.length > 300) continue;

      const lines = text.split(/\n/).filter((l) => l.trim().length > 8);
      for (const line of lines) {
        const clean = stripMarkdownToPlainText(line).trim();
        const id = slugId(clean) || `ex-${nanoid(4)}`;
        if (seen.has(id) || clean.length < 10) continue;
        seen.add(id);

        skills.push({
          id,
          label: clean.slice(0, 80),
          description: `${clean.slice(0, 200)} (dari: ${doc.source} ${doc.url.slice(0, 80)})`,
          kind: classifySkillKind(clean),
        });
        if (skills.length >= 20) break;
      }
      if (skills.length >= 20) break;
    }
  }

  if (skills.length === 0 && content.length > 50) {
    const lines = content.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 15 && l.length < 200);
    for (const line of lines.slice(0, 10)) {
      const clean = stripMarkdownToPlainText(line);
      const id = slugId(clean) || `doc-${nanoid(4)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      skills.push({
        id,
        label: clean.slice(0, 80),
        description: `${clean.slice(0, 200)} (dari: ${doc.source})`,
        kind: classifySkillKind(clean),
      });
      if (skills.length >= 8) break;
    }
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
      includeAnswer: true,
    });
    const parts: string[] = [];
    if (res.answer) parts.push(stripMarkdownToPlainText(res.answer));
    for (const r of res.results) {
      parts.push(stripMarkdownToPlainText(`${r.title}. ${(r.content ?? "").slice(0, 200)}. ${r.url}`));
    }
    return parts.filter(Boolean).join("\n");
  } catch (err) {
    logger.warn({ err, query }, "Skill discovery search failed");
    return "";
  }
}

function roleBucket(role: string): "scout" | "worker" | "reviewer" | "frontend" | "backend" | "general" {
  const r = role.toLowerCase();
  if (r.includes("scout") || r.includes("research")) return "scout";
  if (r.includes("reviewer") || r.includes("qa") || r.includes("quality")) return "reviewer";
  if (r.includes("worker") || r.includes("builder") || r.includes("implementer")) return "worker";
  if (r.includes("frontend") || r.includes("nextjs") || r.includes("ui") || r.includes("react")) return "frontend";
  if (r.includes("backend") || r.includes("api") || r.includes("server") || r.includes("database")) return "backend";
  return "general";
}

function pickSkillsForBucket(catalog: SpecialistSkill[], bucket: string, limit = 12): SpecialistSkill[] {
  const scored = catalog.map((s) => {
    const text = `${s.label} ${s.description}`.toLowerCase();
    let score = 1;
    if (bucket === "scout" && /riset|research|trend|referensi|browse|extract|competitor|analyze|monitor|crawl|scrape/.test(text)) score += 4;
    if (bucket === "worker" && /build|html|css|ui|api|implement|copy|component|generate|create|develop|write|deploy/.test(text)) score += 4;
    if (bucket === "reviewer" && /review|quality|test|audit|check|deliverable|preview|validate|lint|security/.test(text)) score += 4;
    if (bucket === "frontend" && /frontend|html|css|react|next|ui|landing|component|tailwind|responsive|animation/.test(text)) score += 3;
    if (bucket === "backend" && /backend|api|rest|database|prisma|server|express|node|auth|middleware|graphql/.test(text)) score += 3;
    if (/skill\.md|agents\.md|playbook|workflow/i.test(text)) score += 2;
    if (/github-skill|github-agents/i.test(s.description)) score += 2;
    return { s, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

export type SkillDiscoveryResult = {
  catalog: SpecialistSkill[];
  extractedDocs: ExtractedSkillDoc[];
  researchNotes: string;
  knowledgeDigest: string;
};

/**
 * Full real-time skill discovery pipeline:
 * 1. Tavily search queries for agent skills
 * 2. GitHub SKILL.md / AGENTS.md extraction via skill-extractor
 * 3. Doc/npm/awesome-list extraction
 * 4. Parse all into SpecialistSkill catalog
 * 5. Build knowledge digest for injection
 */
export async function discoverSkillsForMission(missionPrompt: string): Promise<SkillDiscoveryResult> {
  const topic = missionPrompt.trim().slice(0, 120);

  const searchQueries = [
    `cursor agent SKILL.md ${topic}`,
    `openclaw agent skills sub-agent ${topic}`,
    `${topic} developer skills capabilities checklist`,
    `${topic} best practices workflow automation agent`,
    "recursive agent specialist skills markdown playbook",
    `${topic} tools libraries frameworks 2026`,
  ];

  const [searchCatalog, extraction] = await Promise.all([
    (async () => {
      const chunks: string[] = [];
      const catalog: SpecialistSkill[] = [];
      const seen = new Set<string>();

      for (const q of searchQueries) {
        const text = await tavilySearch(q);
        if (!text) continue;
        chunks.push(`Query: ${q}\n${text}`);
        for (const sk of parseSkillsFromSearchText(text, q)) {
          if (seen.has(sk.id)) continue;
          seen.add(sk.id);
          catalog.push(sk);
        }
      }
      return { catalog, notes: chunks.join("\n\n").slice(0, 12000) };
    })(),
    extractSkillsFromWeb(missionPrompt),
  ]);

  const docSkills: SpecialistSkill[] = [];
  const docSeen = new Set<string>();
  for (const doc of extraction.docs) {
    for (const sk of parseSkillsFromDoc(doc)) {
      if (docSeen.has(sk.id)) continue;
      docSeen.add(sk.id);
      docSkills.push(sk);
    }
  }

  const allSkills = mergeSkills(searchCatalog.catalog, docSkills);

  logger.info(
    { searchSkills: searchCatalog.catalog.length, docSkills: docSkills.length, totalMerged: allSkills.length, extractedDocs: extraction.docs.length },
    "skill-discovery: pipeline complete"
  );

  return {
    catalog: allSkills,
    extractedDocs: extraction.docs,
    researchNotes: searchCatalog.notes,
    knowledgeDigest: extraction.knowledgeDigest,
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
  missionPrompt: string,
  knowledgeDigest?: string
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
    "Skills (dari real-time web extraction + Central Agent)",
    ...skills.map((s) => `${s.label}. ${s.description}`),
  ];

  if (knowledgeDigest?.trim()) {
    lines.push(
      "",
      "Knowledge dari web (real-time extracted)",
      knowledgeDigest.slice(0, 3000)
    );
  }

  return stripMarkdownToPlainText(lines.join("\n"));
}

export function enrichSubAgentsWithDiscoveredSkills(
  subs: SubAgentDescriptor[],
  catalog: SpecialistSkill[],
  missionPrompt: string,
  knowledgeDigest?: string
): SubAgentDescriptor[] {
  return subs.map((sub) => {
    const bucket = roleBucket(sub.role);
    const picked = pickSkillsForBucket(catalog, bucket, 14);
    return {
      ...sub,
      skillMd: buildSubAgentSkillMd(sub, picked, missionPrompt, knowledgeDigest),
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
    const picked = pickSkillsForBucket(catalog, bucket, 16);
    agent.skills = mergeSkills(agent.skills, picked);
  }
}
