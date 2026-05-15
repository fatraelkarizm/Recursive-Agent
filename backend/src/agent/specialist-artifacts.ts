import type { SpecialistAgentProfile, SpecialistSkill } from "../types";
import { stripMarkdownToPlainText } from "../util/plain-text";

export function buildSpecialistSkills(
  role: string,
  specializations: string[],
  allowedTools: string[]
): SpecialistSkill[] {
  const skills: SpecialistSkill[] = [];

  if (specializations.includes("browser-automation") || allowedTools.includes("tavily-extract")) {
    skills.push({
      id: "touch-web",
      label: "Sentuh web",
      description: "Membaca dan merangkum konten URL lewat Tavily Extract.",
      kind: "touch"
    });
  }

  if (allowedTools.includes("tavily-search")) {
    skills.push({
      id: "research-web",
      label: "Riset web",
      description: "Pencarian dan kutipan sumber via Tavily Search.",
      kind: "touch"
    });
  }

  skills.push({
    id: "generate-deliverable",
    label: "Generate output",
    description: "Menghasilkan jawaban terstruktur sesuai misi.",
    kind: "generate"
  });

  if (specializations.includes("openclaw-orchestration") || allowedTools.includes("openclaw-orchestrator")) {
    skills.push({
      id: "orchestrate-fleet",
      label: "Orkestrasi agent",
      description: "Mengatur fleet sub-agent melalui OpenClaw CLI.",
      kind: "orchestrate"
    });
  }

  if (role.includes("coding")) {
    skills.push({
      id: "code-plan",
      label: "Rencana kode",
      description: "Menyusun langkah patch atau refactor dari deskripsi bug atau fitur.",
      kind: "generate"
    });
  }

  if (role.includes("nextjs") || role.includes("frontend")) {
    skills.push({
      id: "nextjs-app-router",
      label: "Next.js App Router",
      description: "Struktur route, layout, server dan client components.",
      kind: "generate"
    });
    skills.push({
      id: "html-css-wireframe",
      label: "HTML CSS wireframe",
      description: "Markup dan token warna dasar sebelum komponen final.",
      kind: "generate"
    });
  }

  if (role.includes("backend") || role.includes("api-")) {
    skills.push({
      id: "rest-contract",
      label: "Kontrak REST",
      description: "Endpoint, status code, dan payload JSON yang konsisten.",
      kind: "generate"
    });
    skills.push({
      id: "sql-schema-sketch",
      label: "Skema data",
      description: "Tabel relasional dan indeks untuk data aplikasi.",
      kind: "generate"
    });
  }

  return skills;
}

function skillsPlainBlock(skills: SpecialistSkill[]): string {
  if (!skills.length) return "Tidak ada skill.";
  return skills.map((s) => `${s.label}. ${s.description} Jenis: ${s.kind}.`).join("\n");
}

export function buildSpecialistSkillMd(profile: SpecialistAgentProfile, missionPrompt: string): string {
  const raw = [
    `SKILL ${profile.name}`,
    "",
    "Kapan memakai agent ini",
    profile.purpose,
    "",
    "Misi user",
    missionPrompt.trim().slice(0, 1200) || "(kosong)",
    "",
    `Skills (${profile.skills.length} total, real-time dari web + Central Agent)`,
    skillsPlainBlock(profile.skills),
    "",
    "Tools",
    profile.allowedTools.length ? profile.allowedTools.join(", ") : "tidak ada",
    "",
    "Instruksi sistem",
    profile.systemInstructions || "Default Central Agent.",
    "",
    "Spesialisasi",
    profile.specializations.join(", ") || "core-mission",
    "",
    "Output",
    `Format ${profile.outputFormat}`,
    profile.canvasLane ? `Lane ${profile.canvasLane}` : "",
    "",
    "Agent ini di-produce oleh Central Agent Recursive Agent.",
    "Semua skill di atas di-extract real-time dari web (GitHub SKILL.md, docs, npm, awesome-lists) dan di-inject oleh Central Agent."
  ].join("\n");

  return stripMarkdownToPlainText(raw);
}

export function buildSpecialistReadme(profile: SpecialistAgentProfile, missionPrompt: string): string {
  const subCount = profile.subAgents?.length ?? 0;
  const skillCount = profile.skills.length;

  const raw = [
    profile.name,
    "",
    "Tentang agent ini",
    profile.purpose,
    "",
    `Agent ini adalah ${profile.role} specialist yang di-produce oleh Central Agent Recursive Agent.`,
    profile.canvasLane === "frontend"
      ? "Bertugas di lane frontend untuk mengerjakan sisi tampilan, UI, dan interaksi user."
      : profile.canvasLane === "backend"
        ? "Bertugas di lane backend untuk mengerjakan logika server, API, dan data."
        : "Bertugas di lane general untuk mengerjakan tugas lintas domain.",
    "",
    "Kapabilitas",
    `Agent ini memiliki ${skillCount} skill yang di-extract real-time dari web oleh Central Agent.`,
    `Mode orkestrasi: ${profile.orchestrationMode}.`,
    subCount > 0 ? `Memiliki ${subCount} sub-agent (scout, worker, reviewer) untuk eksekusi misi.` : "Tidak memiliki sub-agent.",
    "",
    "Instruksi",
    profile.systemInstructions || "Mengikuti instruksi default Central Agent.",
    "",
    "Tools yang tersedia",
    profile.allowedTools.length ? profile.allowedTools.join(", ") : "Tidak ada tools khusus.",
    "",
    "Spesialisasi",
    profile.specializations.join(", ") || "core-mission",
    "",
    `Output format: ${profile.outputFormat}.`,
    "",
    "Lihat tab SKILL.md untuk daftar lengkap semua skill agent ini."
  ].join("\n");

  return stripMarkdownToPlainText(raw);
}

/** Re-apply plain text readme/skill after HTML or fleet append. */
export function refreshPlainArtifacts(profile: SpecialistAgentProfile, missionPrompt: string): void {
  const htmlMatch = profile.readmeMd.match(/```html[\s\S]*?```/i);
  const htmlBlock = htmlMatch?.[0] ?? "";
  profile.skillMd = buildSpecialistSkillMd(profile, missionPrompt);
  profile.readmeMd = buildSpecialistReadme(profile, missionPrompt);
  if (htmlBlock) {
    profile.readmeMd += [
      "",
      "Deliverable HTML",
      "",
      htmlBlock
    ].join("\n");
  }
}

export function attachSpecialistArtifacts(
  profile: SpecialistAgentProfile,
  missionPrompt: string
): void {
  profile.skillMd = buildSpecialistSkillMd(profile, missionPrompt);
  profile.readmeMd = buildSpecialistReadme(profile, missionPrompt);
}

/** Build Central Agent's own SKILL.md by aggregating ALL skills from squad + sub-agents. */
export function buildCentralAgentSkillMd(
  squad: SpecialistAgentProfile[],
  missionPrompt: string
): string {
  const allSkills: SpecialistSkill[] = [];
  const seen = new Set<string>();

  for (const agent of squad) {
    for (const sk of agent.skills) {
      if (!seen.has(sk.id)) {
        seen.add(sk.id);
        allSkills.push(sk);
      }
    }
    for (const sub of agent.subAgents ?? []) {
      const subLabel = `sub-${sub.role}-${sub.focus.slice(0, 30)}`;
      const subId = subLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (!seen.has(subId)) {
        seen.add(subId);
        allSkills.push({
          id: subId,
          label: `${sub.role} sub-agent`,
          description: sub.focus,
          kind: "orchestrate"
        });
      }
    }
  }

  const byKind: Record<string, SpecialistSkill[]> = {};
  for (const sk of allSkills) {
    (byKind[sk.kind] ??= []).push(sk);
  }

  const kindLabel: Record<string, string> = {
    touch: "Riset dan Ekstraksi",
    generate: "Produksi dan Generate",
    orchestrate: "Orkestrasi dan Koordinasi",
    other: "Lainnya"
  };

  const sections: string[] = [
    "SKILL Central Agent (Recursive Agent)",
    "",
    `Total ${allSkills.length} skills dari ${squad.length} specialist`,
    "",
    "Misi",
    stripMarkdownToPlainText(missionPrompt.trim().slice(0, 1500) || "(kosong)"),
    "",
    "Squad specialists",
    ...squad.map((s) => `${s.name}. ${s.role}. ${s.purpose}. Lane ${s.canvasLane ?? "general"}. ${s.skills.length} skills.`),
    ""
  ];

  for (const [kind, label] of Object.entries(kindLabel)) {
    const items = byKind[kind];
    if (!items?.length) continue;
    sections.push(`${label} (${items.length})`);
    for (const sk of items) {
      sections.push(`${sk.label}. ${sk.description}`);
    }
    sections.push("");
  }

  sections.push(
    "Central Agent mengumpulkan semua skill di atas dari seluruh squad dan sub-agent.",
    "Setiap skill di-extract real-time dari web (GitHub SKILL.md, docs, npm, awesome-lists)."
  );

  return stripMarkdownToPlainText(sections.join("\n"));
}

/** Build Central Agent's own README.md describing what it is and what it produced. */
export function buildCentralAgentReadme(
  squad: SpecialistAgentProfile[],
  missionPrompt: string,
  motherBrief: string
): string {
  const totalSkills = new Set(squad.flatMap((s) => s.skills.map((sk) => sk.id))).size;
  const totalSubs = squad.reduce((n, s) => n + (s.subAgents?.length ?? 0), 0);

  const sections: string[] = [
    "Central Agent (Recursive Agent)",
    "",
    "Tentang Central Agent",
    "Central Agent adalah orchestrator utama dari Recursive Agent.",
    "Tugasnya adalah menerima misi dari user, melakukan riset web real-time, mengekstrak skill dari internet, dan memproduce squad specialist agent yang masing-masing punya keahlian spesifik.",
    "",
    "Apa yang dilakukan Central Agent",
    "1. Menerima misi dan melakukan riset web otomatis via Tavily",
    "2. Mengekstrak SKILL.md, dokumentasi, dan best practices dari GitHub dan web",
    "3. Merancang squad specialist berdasarkan kebutuhan misi",
    "4. Meng-inject skill yang ditemukan ke setiap specialist dan sub-agent",
    "5. Menjalankan fleet sub-agent (scout, worker, reviewer) via OpenClaw",
    "6. Melakukan quality review terhadap output setiap agent",
    "",
    "Pemikiran Central Agent",
    stripMarkdownToPlainText(motherBrief.trim().slice(0, 1500) || "(belum ada brief)"),
    "",
    `Squad yang diproduce (${squad.length} specialist, ${totalSubs} sub-agent, ${totalSkills} skill unik)`,
    ...squad.map((s) => {
      const subCount = s.subAgents?.length ?? 0;
      return [
        `${s.name}`,
        `  Role: ${s.role}`,
        `  Lane: ${s.canvasLane ?? "general"}`,
        `  ${s.purpose}`,
        `  ${s.skills.length} skills, ${subCount} sub-agent, mode ${s.orchestrationMode}`
      ].join("\n");
    }),
    "",
    "Misi yang diterima",
    stripMarkdownToPlainText(missionPrompt.trim().slice(0, 1500) || "(kosong)"),
    "",
    "Lihat tab SKILL.md untuk daftar lengkap semua skill yang dimiliki Central Agent."
  ];

  return stripMarkdownToPlainText(sections.join("\n"));
}
