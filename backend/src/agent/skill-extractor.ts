import { tavily } from "@tavily/core";
import { stripMarkdownToPlainText } from "../util/plain-text";
import { logger } from "../logging";

export type ExtractedSkillDoc = {
  url: string;
  title: string;
  content: string;
  source: "github-skill" | "github-agents" | "docs" | "awesome-list" | "npm-readme" | "web";
};

function tavilyKey(): string | null {
  return process.env.TAVILY_API_KEY?.trim() || null;
}

async function tavilySearchUrls(query: string, max = 8): Promise<Array<{ url: string; title: string; snippet: string }>> {
  const key = tavilyKey();
  if (!key) return [];
  const client = tavily({ apiKey: key });
  try {
    const res = await client.search(query.slice(0, 400), {
      maxResults: max,
      searchDepth: "advanced",
      includeAnswer: false,
    });
    return res.results.map((r) => ({
      url: r.url,
      title: r.title ?? "",
      snippet: (r.content ?? "").slice(0, 400),
    }));
  } catch (err) {
    logger.warn({ err, query }, "skill-extractor: tavily search failed");
    return [];
  }
}

async function tavilyExtract(urls: string[]): Promise<Array<{ url: string; content: string }>> {
  const key = tavilyKey();
  if (!key || urls.length === 0) return [];
  const client = tavily({ apiKey: key });
  try {
    const res = await client.extract(urls.slice(0, 10));
    return (res.results ?? []).map((r: { url: string; rawContent?: string }) => ({
      url: r.url,
      content: (r.rawContent ?? "").slice(0, 6000),
    }));
  } catch (err) {
    logger.warn({ err }, "skill-extractor: tavily extract failed");
    return [];
  }
}

/** Search GitHub for SKILL.md and AGENTS.md files related to a topic. */
async function findGitHubSkillFiles(topic: string): Promise<ExtractedSkillDoc[]> {
  const queries = [
    `site:github.com "${topic}" SKILL.md path:SKILL.md`,
    `site:github.com "${topic}" AGENTS.md path:.cursor`,
    `site:github.com "${topic}" agent skills markdown`,
    `site:github.com cursor rules "${topic}" .mdc OR .md`,
  ];

  const allResults = await Promise.all(queries.map((q) => tavilySearchUrls(q, 6)));

  const urls: Array<{ url: string; title: string; source: ExtractedSkillDoc["source"] }> = [];
  const seen = new Set<string>();

  for (const results of allResults) {
    for (const r of results) {
      const norm = r.url.replace(/[#?].*$/, "");
      if (seen.has(norm)) continue;
      seen.add(norm);

      const isSkill = /SKILL\.md|skill\.md/i.test(r.url);
      const isAgents = /AGENTS\.md|agents\.md/i.test(r.url);
      const source: ExtractedSkillDoc["source"] = isSkill
        ? "github-skill"
        : isAgents
          ? "github-agents"
          : "docs";

      urls.push({ url: convertToRawGithub(norm), title: r.title, source });
    }
    if (urls.length >= 12) break;
  }

  if (urls.length === 0) return [];

  const extracted = await tavilyExtract(urls.map((u) => u.url));
  const docs: ExtractedSkillDoc[] = [];
  for (const ex of extracted) {
    const meta = urls.find((u) => u.url === ex.url || u.url.includes(ex.url.split("/").pop() ?? "__none__"));
    if (!ex.content.trim()) continue;
    docs.push({
      url: ex.url,
      title: meta?.title ?? ex.url.split("/").pop() ?? "unknown",
      content: ex.content.slice(0, 5000),
      source: meta?.source ?? "web",
    });
  }
  return docs;
}

/** Search for npm/library documentation and best practices for a topic. */
async function findDocSkills(topic: string): Promise<ExtractedSkillDoc[]> {
  const queries = [
    `"${topic}" best practices developer guide 2025 2026`,
    `"${topic}" agent skills capabilities checklist`,
    `awesome "${topic}" curated list github`,
    `"${topic}" npm package README skills`,
  ];

  const allDocResults = await Promise.all(queries.map((q) => tavilySearchUrls(q, 5)));

  const urls: Array<{ url: string; title: string; source: ExtractedSkillDoc["source"] }> = [];
  const seen = new Set<string>();

  for (const results of allDocResults) {
    for (const r of results) {
      const norm = r.url.replace(/[#?].*$/, "");
      if (seen.has(norm)) continue;
      seen.add(norm);

      const isAwesome = /awesome/i.test(r.url) || /awesome/i.test(r.title);
      const isNpm = /npmjs\.com|npm/i.test(r.url);
      const source: ExtractedSkillDoc["source"] = isAwesome
        ? "awesome-list"
        : isNpm
          ? "npm-readme"
          : "docs";

      urls.push({ url: norm, title: r.title, source });
    }
    if (urls.length >= 10) break;
  }

  if (urls.length === 0) return [];

  const extracted = await tavilyExtract(urls.map((u) => u.url));
  return extracted
    .filter((ex) => ex.content.trim().length > 50)
    .map((ex) => {
      const meta = urls.find((u) => u.url === ex.url);
      return {
        url: ex.url,
        title: meta?.title ?? "",
        content: ex.content.slice(0, 4000),
        source: meta?.source ?? "web",
      };
    });
}

/** Search for real-time trending tools and techniques for a topic. */
async function findRealtimeKnowledge(topic: string): Promise<ExtractedSkillDoc[]> {
  const queries = [
    `${topic} latest tools techniques 2026`,
    `${topic} AI agent framework capabilities`,
    `${topic} developer workflow automation skills`,
  ];

  const allRtResults = await Promise.all(queries.map((q) => tavilySearchUrls(q, 5)));

  const urls: Array<{ url: string; title: string }> = [];
  const seen = new Set<string>();

  for (const results of allRtResults) {
    for (const r of results) {
      const norm = r.url.replace(/[#?].*$/, "");
      if (seen.has(norm)) continue;
      seen.add(norm);
      urls.push({ url: norm, title: r.title });
    }
    if (urls.length >= 8) break;
  }

  if (urls.length === 0) return [];

  const extracted = await tavilyExtract(urls.map((u) => u.url));
  return extracted
    .filter((ex) => ex.content.trim().length > 50)
    .map((ex) => ({
      url: ex.url,
      title: urls.find((u) => u.url === ex.url)?.title ?? "",
      content: ex.content.slice(0, 4000),
      source: "web" as const,
    }));
}

function convertToRawGithub(url: string): string {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/);
  if (m) {
    return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
  }
  return url;
}

/** Extract knowledge topics from a mission prompt. */
function extractTopics(prompt: string): string[] {
  const topics: string[] = [];
  const lower = prompt.toLowerCase();

  const techPatterns = [
    /\b(react|nextjs|next\.js|vue|angular|svelte)\b/gi,
    /\b(node|express|fastify|nestjs|django|flask|fastapi)\b/gi,
    /\b(typescript|python|rust|golang|go)\b/gi,
    /\b(prisma|postgres|mongodb|redis|supabase)\b/gi,
    /\b(tailwind|css|sass|styled-components)\b/gi,
    /\b(docker|kubernetes|aws|gcp|azure|vercel|netlify)\b/gi,
    /\b(openai|langchain|llamaindex|anthropic|huggingface)\b/gi,
    /\b(crypto|blockchain|web3|defi|nft|solana|ethereum)\b/gi,
    /\b(landing\s*page|website|web\s*app|mobile\s*app|saas|api)\b/gi,
    /\b(machine\s*learning|deep\s*learning|nlp|computer\s*vision)\b/gi,
    /\b(security|authentication|oauth|jwt)\b/gi,
    /\b(testing|ci\/cd|devops|monitoring)\b/gi,
  ];

  for (const pattern of techPatterns) {
    const matches = prompt.match(pattern);
    if (matches) {
      for (const m of matches) {
        const clean = m.trim().toLowerCase();
        if (!topics.includes(clean)) topics.push(clean);
      }
    }
  }

  if (topics.length === 0) {
    const words = lower
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !["buat", "bikin", "yang", "dengan", "untuk", "dari", "misi", "agent"].includes(w));
    topics.push(...words.slice(0, 3));
  }

  return topics.slice(0, 5);
}

export type SkillExtractionResult = {
  docs: ExtractedSkillDoc[];
  topics: string[];
  knowledgeDigest: string;
};

/**
 * Full real-time skill extraction pipeline:
 * 1. Extract topics from the mission prompt
 * 2. Search GitHub for SKILL.md / AGENTS.md files
 * 3. Search docs, awesome-lists, npm readmes
 * 4. Search real-time trending knowledge
 * 5. Compile into a knowledge digest for agent injection
 */
export async function extractSkillsFromWeb(missionPrompt: string): Promise<SkillExtractionResult> {
  const topics = extractTopics(missionPrompt);
  const topicStr = topics.join(" ");

  logger.info({ topics }, "skill-extractor: starting real-time extraction");

  const [githubDocs, docSkills, realtimeDocs] = await Promise.all([
    findGitHubSkillFiles(topicStr),
    findDocSkills(topicStr),
    findRealtimeKnowledge(topicStr),
  ]);

  const allDocs = [...githubDocs, ...docSkills, ...realtimeDocs];
  const seen = new Set<string>();
  const deduped = allDocs.filter((d) => {
    const key = d.url.replace(/[#?].*$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const digest = buildKnowledgeDigest(deduped, topics);

  logger.info(
    { topics, githubCount: githubDocs.length, docsCount: docSkills.length, realtimeCount: realtimeDocs.length, totalDeduped: deduped.length },
    "skill-extractor: extraction complete"
  );

  return { docs: deduped, topics, knowledgeDigest: digest };
}

function buildKnowledgeDigest(docs: ExtractedSkillDoc[], topics: string[]): string {
  const sections: string[] = [];
  sections.push(`Knowledge digest untuk topik: ${topics.join(", ")}`);
  sections.push(`Total ${docs.length} sumber ditemukan real-time dari web.`);
  sections.push("");

  const bySource: Record<string, ExtractedSkillDoc[]> = {};
  for (const d of docs) {
    (bySource[d.source] ??= []).push(d);
  }

  const sourceLabels: Record<string, string> = {
    "github-skill": "SKILL.md dari GitHub (agent playbooks)",
    "github-agents": "AGENTS.md dari GitHub (agent configs)",
    docs: "Dokumentasi dan best practices",
    "awesome-list": "Awesome lists (curated knowledge)",
    "npm-readme": "NPM packages (README)",
    web: "Web knowledge (real-time)",
  };

  for (const [src, label] of Object.entries(sourceLabels)) {
    const items = bySource[src];
    if (!items?.length) continue;
    sections.push(`${label} (${items.length} sumber)`);
    for (const item of items.slice(0, 5)) {
      const clean = stripMarkdownToPlainText(item.content.slice(0, 1500));
      sections.push(`Sumber: ${item.title}`);
      sections.push(`URL: ${item.url}`);
      sections.push(clean);
      sections.push("");
    }
  }

  return stripMarkdownToPlainText(sections.join("\n")).slice(0, 20000);
}
