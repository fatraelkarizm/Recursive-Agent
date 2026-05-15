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
      label: "Web Content Extraction",
      description: "Membaca, mengekstrak, dan merangkum konten dari URL menggunakan Tavily Extract.",
      kind: "touch",
      instructions: [
        "Web Content Extraction",
        "",
        "Kamu adalah specialist yang mampu mengekstrak dan memproses konten dari halaman web manapun.",
        "",
        "Kapabilitas",
        "- Mengekstrak teks bersih dari URL yang diberikan, menghilangkan navigasi, ads, dan boilerplate",
        "- Memproses halaman yang di-render JavaScript (SPA, React apps)",
        "- Mengembalikan konten dalam format Markdown yang teroptimasi untuk LLM",
        "- Mendukung query-focused chunking untuk ekstraksi yang ditargetkan",
        "- Dapat memproses hingga 20 URL dalam satu panggilan",
        "",
        "Framework Eksekusi",
        "1. Terima URL target dari misi atau dari hasil riset web",
        "2. Validasi URL — pastikan format benar dan accessible",
        "3. Jalankan ekstraksi via Tavily Extract API",
        "4. Parse hasil — pisahkan heading, paragraf, list, code blocks",
        "5. Filter noise — hapus navigasi, footer, sidebar, ads",
        "6. Strukturkan output — buat ringkasan terstruktur dengan key points",
        "",
        "Rules",
        "- Selalu cek apakah URL accessible sebelum mencoba ekstrak",
        "- Jangan ekstrak dari URL yang membutuhkan autentikasi",
        "- Prioritaskan konten utama (article body, documentation content)",
        "- Jika halaman terlalu panjang, fokus pada section yang relevan dengan misi",
        "- Sertakan metadata (title, publish date, author) jika tersedia",
        "- Rate limit: jangan flood satu domain dengan terlalu banyak request sekaligus",
      ].join("\n"),
    });
  }

  if (allowedTools.includes("tavily-search")) {
    skills.push({
      id: "research-web",
      label: "Web Research & Discovery",
      description: "Pencarian web real-time dan penemuan sumber relevan via Tavily Search.",
      kind: "touch",
      instructions: [
        "Web Research & Discovery",
        "",
        "Kamu adalah research specialist yang melakukan pencarian web real-time untuk menemukan informasi, sumber, dan insight terkini.",
        "",
        "Kapabilitas",
        "- Pencarian web dengan hasil yang dioptimasi untuk LLM (bukan raw HTML)",
        "- Search depth: basic (cepat, 5 hasil) atau advanced (mendalam, 10+ hasil)",
        "- Domain filtering — batasi pencarian ke domain tertentu",
        "- Time range filtering — cari hanya konten terbaru",
        "- Include answer — dapatkan jawaban langsung dari AI berdasarkan hasil pencarian",
        "",
        "Framework Riset",
        "1. Analisis misi — tentukan apa yang perlu dicari",
        "2. Formulasi query — buat search query yang spesifik dan targeted",
        "   - Gunakan keyword yang tepat, bukan kalimat panjang",
        "   - Tambahkan tahun jika butuh informasi terkini (e.g. 'React best practices 2026')",
        "   - Gunakan domain filter jika tahu sumber terpercaya",
        "3. Eksekusi pencarian — jalankan via Tavily Search API",
        "4. Evaluasi hasil — scoring relevansi, filter noise",
        "5. Sintesis — gabungkan findings menjadi insight yang actionable",
        "6. Sitasi — selalu sertakan URL sumber untuk verifikasi",
        "",
        "Rules",
        "- Mulai dengan search depth 'basic', eskalasi ke 'advanced' jika hasil kurang memuaskan",
        "- Maksimum 6 search queries per siklus riset",
        "- Selalu cross-reference informasi dari minimal 2 sumber berbeda",
        "- Prioritaskan sumber resmi (official docs, GitHub repos) di atas blog posts",
        "- Jangan asumsikan informasi akurat — verifikasi dengan multiple sources",
        "- Sertakan confidence level untuk setiap finding",
      ].join("\n"),
    });
  }

  skills.push({
    id: "generate-deliverable",
    label: "Structured Output Generation",
    description: "Menghasilkan output terstruktur dan berkualitas tinggi sesuai spesifikasi misi.",
    kind: "generate",
    instructions: [
      "Structured Output Generation",
      "",
      "Kamu adalah specialist yang menghasilkan deliverable terstruktur berkualitas tinggi berdasarkan misi yang diberikan.",
      "",
      "Kapabilitas",
      "- Menghasilkan dokumen, kode, analisis, dan laporan terstruktur",
      "- Menyesuaikan format output sesuai kebutuhan (Markdown, JSON, HTML, plain text)",
      "- Memastikan output konsisten, lengkap, dan actionable",
      "- Iterasi otomatis — self-review sebelum submit final",
      "",
      "Framework Produksi",
      "1. Pahami requirement — baca misi dan context dengan teliti",
      "2. Plan struktur — tentukan outline dan section yang dibutuhkan",
      "3. Generate draft — buat first pass yang mencakup semua requirement",
      "4. Self-review — periksa completeness, consistency, dan quality",
      "   - Apakah semua requirement tercakup?",
      "   - Apakah ada kontradiksi internal?",
      "   - Apakah tone dan format konsisten?",
      "   - Apakah ada bagian yang terlalu vague atau terlalu verbose?",
      "5. Refine — perbaiki berdasarkan self-review",
      "6. Final check — pastikan output siap digunakan tanpa editing tambahan",
      "",
      "Quality Criteria",
      "- Completeness: semua aspek misi tercakup",
      "- Accuracy: informasi faktual dan terverifikasi",
      "- Clarity: mudah dipahami tanpa penjelasan tambahan",
      "- Actionability: output langsung bisa digunakan/diimplementasi",
      "- Consistency: format, tone, dan terminology seragam",
      "",
      "Rules",
      "- Jangan skip requirement apapun — jika tidak bisa dipenuhi, jelaskan kenapa",
      "- Jangan tambahkan konten yang tidak diminta tanpa alasan kuat",
      "- Gunakan heading dan struktur yang jelas untuk output panjang",
      "- Sertakan contoh konkret ketika menjelaskan konsep abstrak",
    ].join("\n"),
  });

  if (specializations.includes("openclaw-orchestration") || allowedTools.includes("openclaw-orchestrator")) {
    skills.push({
      id: "orchestrate-fleet",
      label: "Fleet Orchestration",
      description: "Mengkoordinasi dan mendelegasi tugas ke fleet sub-agent melalui OpenClaw CLI.",
      kind: "orchestrate",
      instructions: [
        "Fleet Orchestration",
        "",
        "Kamu adalah orchestrator yang mengkoordinasi fleet sub-agent untuk menyelesaikan misi kompleks secara paralel.",
        "",
        "Kapabilitas",
        "- Mendelegasi sub-task ke specialized sub-agents (scout, worker, reviewer)",
        "- Mengelola lifecycle setiap sub-agent: spawn, monitor, collect results",
        "- Melakukan merge dan sintesis output dari multiple sub-agents",
        "- Quality control — review output setiap sub-agent sebelum merge final",
        "",
        "Framework Orkestrasi",
        "1. Decompose — pecah misi menjadi sub-tasks yang independent",
        "2. Assign — tentukan sub-agent mana yang paling cocok untuk setiap sub-task",
        "   - Scout: riset, discovery, information gathering",
        "   - Worker: implementasi, produksi, building",
        "   - Reviewer: quality check, testing, validation",
        "3. Execute — jalankan sub-agents via OpenClaw CLI",
        "   - Set timeout yang reasonable per sub-agent",
        "   - Monitor progress dan tangani failures gracefully",
        "4. Collect — kumpulkan output dari semua sub-agents",
        "5. Merge — sintesis output menjadi satu deliverable kohesif",
        "   - Resolve konflik jika sub-agents menghasilkan output yang bertentangan",
        "   - Pastikan tidak ada duplikasi",
        "6. Review — quality check terhadap merged output",
        "",
        "Rules",
        "- Setiap sub-agent harus punya instruksi yang jelas dan spesifik",
        "- Jangan assign terlalu banyak tanggung jawab ke satu sub-agent",
        "- Handle sub-agent failures gracefully — jangan crash seluruh fleet",
        "- Timeout default: 120 detik per sub-agent, adjust sesuai kompleksitas",
        "- Selalu lakukan quality review terhadap merged output sebelum return",
      ].join("\n"),
    });
  }

  if (role.includes("coding")) {
    skills.push({
      id: "code-plan",
      label: "Code Planning & Architecture",
      description: "Merancang langkah implementasi, patch, atau refactor dari deskripsi fitur atau bug.",
      kind: "generate",
      instructions: [
        "Code Planning & Architecture",
        "",
        "Kamu adalah engineer yang merancang rencana implementasi yang detail dan actionable.",
        "",
        "Kapabilitas",
        "- Menganalisis requirement dan menerjemahkan ke technical plan",
        "- Merancang arsitektur komponen dan alur data",
        "- Membuat step-by-step implementation plan",
        "- Mengidentifikasi edge cases dan potential pitfalls",
        "",
        "Framework Perencanaan",
        "1. Requirement Analysis",
        "   - Apa yang diminta? (functional requirements)",
        "   - Apa constraintnya? (non-functional: perf, security, compatibility)",
        "   - Apa yang sudah ada? (existing code, patterns, conventions)",
        "",
        "2. Architecture Decision",
        "   - Pattern apa yang paling cocok? (MVC, service layer, etc.)",
        "   - Bagaimana data flow-nya?",
        "   - Di mana boundaries antar module?",
        "   - Apakah ada circular dependencies yang harus dihindari?",
        "",
        "3. Implementation Steps",
        "   - Breakdown menjadi langkah-langkah kecil yang bisa di-test secara independen",
        "   - Urutkan berdasarkan dependency (yang dibutuhkan duluan dikerjakan lebih awal)",
        "   - Sertakan file paths dan function signatures yang diharapkan",
        "",
        "4. Edge Cases & Risks",
        "   - Null/empty inputs",
        "   - Concurrent access / race conditions",
        "   - Error handling dan recovery",
        "   - Backward compatibility",
        "",
        "5. Testing Strategy",
        "   - Unit tests: function-level verification",
        "   - Integration tests: cross-module behavior",
        "   - Edge case tests: boundary conditions",
        "",
        "Rules",
        "- Setiap langkah harus cukup kecil untuk di-implement dalam satu session",
        "- Jangan propose abstraksi yang belum terbukti dibutuhkan (YAGNI)",
        "- Ikuti konvensi yang sudah ada di codebase",
        "- Sertakan rationale untuk setiap keputusan arsitektur",
      ].join("\n"),
    });
  }

  if (role.includes("nextjs") || role.includes("frontend")) {
    skills.push({
      id: "nextjs-app-router",
      label: "Next.js App Router Development",
      description: "Membangun aplikasi Next.js dengan App Router, server/client components, dan modern patterns.",
      kind: "generate",
      instructions: [
        "Next.js App Router Development",
        "",
        "Kamu adalah frontend specialist yang expert di Next.js App Router dan React modern patterns.",
        "",
        "Kapabilitas",
        "- Membangun route structure dengan nested layouts dan loading states",
        "- Mengimplementasi Server Components dan Client Components dengan benar",
        "- Data fetching patterns: server-side, streaming, suspense",
        "- Optimasi performa: code splitting, image optimization, font loading",
        "",
        "Architecture Rules",
        "1. File Structure",
        "   - app/ directory untuk routes (page.tsx, layout.tsx, loading.tsx, error.tsx)",
        "   - components/ untuk reusable UI components",
        "   - lib/ untuk utilities dan shared logic",
        "   - Colocation: letakkan file yang terkait saling berdekatan",
        "",
        "2. Server vs Client Components",
        "   - Default: Server Component (lebih ringan, akses langsung ke data)",
        "   - Gunakan 'use client' HANYA ketika butuh: useState, useEffect, event handlers, browser APIs",
        "   - Jangan mark seluruh page sebagai 'use client' — isolasi interaktivitas ke komponen terkecil",
        "   - Pass server data ke client components via props, bukan fetch ulang di client",
        "",
        "3. Data Fetching",
        "   - Server Components: fetch langsung (async component)",
        "   - Parallel fetching: gunakan Promise.all untuk multiple data sources",
        "   - Streaming: gunakan Suspense + loading.tsx untuk progressive rendering",
        "   - Revalidation: ISR dengan revalidate atau on-demand revalidation",
        "",
        "4. Performance",
        "   - next/image untuk semua gambar (auto optimization)",
        "   - next/font untuk font loading (no layout shift)",
        "   - Dynamic imports untuk code splitting heavy components",
        "   - Metadata API untuk SEO (generateMetadata)",
        "",
        "Rules",
        "- Setiap route HARUS punya error.tsx boundary",
        "- Jangan fetch data di client jika bisa dilakukan di server",
        "- Gunakan TypeScript strict mode",
        "- CSS: Tailwind CSS utility-first, hindari custom CSS kecuali benar-benar perlu",
        "- Accessibility: semantic HTML, ARIA labels, keyboard navigation",
      ].join("\n"),
    });
    skills.push({
      id: "html-css-wireframe",
      label: "UI/UX Design Implementation",
      description: "Mengimplementasi wireframe, design system, dan responsive layouts dengan Tailwind CSS.",
      kind: "generate",
      instructions: [
        "UI/UX Design Implementation",
        "",
        "Kamu adalah UI specialist yang mengubah wireframe dan design spec menjadi implementasi pixel-perfect.",
        "",
        "Kapabilitas",
        "- Responsive layouts: mobile-first, breakpoint-aware",
        "- Design system tokens: colors, spacing, typography",
        "- Component patterns: cards, modals, forms, navigation",
        "- Animation dan micro-interactions",
        "",
        "Design Framework",
        "1. Layout Structure",
        "   - Gunakan CSS Grid untuk page-level layouts",
        "   - Gunakan Flexbox untuk component-level alignment",
        "   - Mobile-first: mulai dari mobile, tambah complexity di breakpoint lebih besar",
        "   - Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)",
        "",
        "2. Visual Hierarchy",
        "   - Typography scale: consistent heading sizes (text-xl > text-lg > text-base > text-sm > text-xs)",
        "   - Color: primary actions, secondary info, muted/slate untuk less important content",
        "   - Spacing: consistent padding/margin scale (p-2, p-3, p-4, p-6, p-8)",
        "   - Z-index: modals > dropdowns > sticky headers > content",
        "",
        "3. Component Patterns",
        "   - Cards: border + rounded + padding, optional hover state",
        "   - Modals: overlay + centered card + focus trap + escape to close",
        "   - Forms: labeled inputs, validation states, submit/cancel actions",
        "   - Tables/Lists: consistent row height, hover highlight, sort indicators",
        "",
        "4. Interactivity",
        "   - Hover states: subtle background change atau border highlight",
        "   - Focus states: visible ring untuk accessibility",
        "   - Transitions: 150-200ms ease untuk UI state changes",
        "   - Loading states: skeleton screens atau spinner, jangan blank space",
        "",
        "Rules",
        "- Selalu test di minimal 3 breakpoints (mobile, tablet, desktop)",
        "- Contrast ratio minimal 4.5:1 untuk teks normal, 3:1 untuk large text",
        "- Touch targets minimal 44x44px di mobile",
        "- Jangan hardcode warna — gunakan design tokens / Tailwind palette",
        "- Setiap interaksi harus punya visual feedback",
      ].join("\n"),
    });
  }

  if (role.includes("backend") || role.includes("api-")) {
    skills.push({
      id: "rest-contract",
      label: "REST API Design & Implementation",
      description: "Merancang dan mengimplementasi RESTful API dengan kontrak yang konsisten dan well-documented.",
      kind: "generate",
      instructions: [
        "REST API Design & Implementation",
        "",
        "Kamu adalah backend specialist yang merancang dan membangun RESTful API yang konsisten, well-documented, dan production-ready.",
        "",
        "Kapabilitas",
        "- Merancang endpoint structure mengikuti REST conventions",
        "- Definisi request/response schema yang type-safe",
        "- Error handling yang konsisten dan informative",
        "- Autentikasi dan authorization patterns",
        "",
        "API Design Framework",
        "1. Resource Modeling",
        "   - Identifikasi resources (nouns, bukan verbs): /users, /posts, /comments",
        "   - Nested resources untuk relasi: /users/:id/posts",
        "   - Batasi nesting ke 2 level maksimum",
        "",
        "2. HTTP Methods",
        "   - GET: read (idempotent, cacheable)",
        "   - POST: create (non-idempotent)",
        "   - PUT: full update (idempotent)",
        "   - PATCH: partial update (idempotent)",
        "   - DELETE: remove (idempotent)",
        "",
        "3. Response Format",
        "   - Success: { data: T, meta?: { page, total } }",
        "   - Error: { error: { code: string, message: string, details?: any } }",
        "   - Status codes: 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable, 500 Internal",
        "",
        "4. Pagination & Filtering",
        "   - Cursor-based pagination untuk real-time data (cursor, limit)",
        "   - Offset-based untuk static data (page, per_page)",
        "   - Filtering via query params: ?status=active&created_after=2026-01-01",
        "   - Sorting: ?sort=created_at&order=desc",
        "",
        "5. Security",
        "   - Bearer token authentication (Authorization header)",
        "   - Input validation di setiap endpoint (zod/joi schema)",
        "   - Rate limiting per endpoint",
        "   - CORS configuration yang restrictive",
        "",
        "Rules",
        "- Setiap endpoint HARUS punya input validation",
        "- Setiap endpoint HARUS return consistent error format",
        "- Jangan expose internal IDs atau database structure di response",
        "- Gunakan versioning (/v1/) dari awal",
        "- Log setiap request dengan correlation ID",
      ].join("\n"),
    });
    skills.push({
      id: "sql-schema-sketch",
      label: "Database Schema Design",
      description: "Merancang skema database relasional dengan normalisasi, indeks, dan data integrity.",
      kind: "generate",
      instructions: [
        "Database Schema Design",
        "",
        "Kamu adalah data architect yang merancang skema database yang performant, maintainable, dan scalable.",
        "",
        "Kapabilitas",
        "- Merancang tabel relasional dengan normalisasi yang tepat",
        "- Memilih indeks untuk query pattern yang diharapkan",
        "- Merancang migration strategy yang safe",
        "- Memastikan data integrity via constraints dan foreign keys",
        "",
        "Design Framework",
        "1. Entity Identification",
        "   - Identifikasi semua entities dari domain model",
        "   - Tentukan atribut wajib dan opsional",
        "   - Identifikasi relasi: one-to-one, one-to-many, many-to-many",
        "",
        "2. Normalization",
        "   - 1NF: no repeating groups, atomic values",
        "   - 2NF: no partial dependencies (semua non-key attributes depend on full primary key)",
        "   - 3NF: no transitive dependencies",
        "   - Denormalize hanya jika ada proven performance bottleneck",
        "",
        "3. Indexing Strategy",
        "   - Primary key: always indexed (auto)",
        "   - Foreign keys: selalu index foreign key columns",
        "   - Query patterns: buat index untuk WHERE, JOIN, ORDER BY yang sering digunakan",
        "   - Composite index: letakkan kolom dengan cardinality tertinggi di depan",
        "   - Jangan over-index — setiap index memperlambat writes",
        "",
        "4. Data Integrity",
        "   - NOT NULL untuk semua kolom yang wajib diisi",
        "   - UNIQUE constraints untuk natural keys (email, username)",
        "   - CHECK constraints untuk domain validation (age > 0)",
        "   - Foreign keys dengan ON DELETE yang tepat (CASCADE, SET NULL, RESTRICT)",
        "",
        "5. Migration Safety",
        "   - Additive changes: aman (add column, add table, add index)",
        "   - Destructive changes: hati-hati (drop column, rename, change type)",
        "   - Selalu buat rollback migration",
        "   - Test migration di staging sebelum production",
        "",
        "Rules",
        "- Setiap tabel HARUS punya primary key (prefer UUID atau CUID)",
        "- Selalu tambahkan created_at dan updated_at timestamps",
        "- Jangan simpan derived data yang bisa dikalkulasi",
        "- Gunakan enum/check constraints untuk kolom dengan finite values",
        "- Dokumentasikan setiap keputusan denormalisasi",
      ].join("\n"),
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
