import type { SpecialistAgentProfile } from "../types";

const LOVABLE_DOCS = "https://docs.lovable.dev/integrations/lovable-api";

function lovableSection(): string {
  const key = process.env.LOVABLE_API_KEY?.trim();
  if (!key) {
    return [
      "## Opsional: Lovable (generate app dari prompt)",
      "",
      "Kalau mau UI/prototype cepat dengan alur “prompt → app”, pertimbangkan [Lovable](https://lovable.dev) — ada dokumentasi API di dokumentasi resmi mereka.",
      `Ringkas: OAuth token + endpoint \`api.lovable.dev\` (lihat ${LOVABLE_DOCS}).`,
      "",
      "Di backend Recursive Agent, set `LOVABLE_API_KEY` bila kamu sudah punya token; README squad akan menandai bahwa integrasi lanjutan bisa diarahkan ke Lovable."
    ].join("\n");
  }
  return [
    "## Lovable",
    "",
    "`LOVABLE_API_KEY` terdeteksi di environment — kamu bisa mengarahkan prototype UI ke [Lovable API](https://docs.lovable.dev/integrations/lovable-api) (OAuth + proyek) sebagai alternatif atau pelengkap Next.js lokal."
  ].join("\n");
}

/** Mutates `profile.readmeMd` with HTML/CSS + Next.js-oriented starter for article/CMS-style UIs. */
export function appendFrontendWebStackReadme(profile: SpecialistAgentProfile, missionPrompt: string): void {
  const topic = missionPrompt.trim().slice(0, 120) || "Article CMS";

  const htmlBlock = [
    "<!DOCTYPE html>",
    '<html lang="id">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${topic.replace(/</g, "")} — wireframe</title>`,
    "  <style>",
    "    :root { --bg: #0b1220; --card: #121a2b; --accent: #38bdf8; --text: #e2e8f0; }",
    "    * { box-sizing: border-box; }",
    "    body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); }",
    "    header { padding: 1rem 1.25rem; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; }",
    "    .logo { font-weight: 700; letter-spacing: 0.04em; color: var(--accent); }",
    "    main { max-width: 960px; margin: 0 auto; padding: 1.5rem; }",
    "    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }",
    "    article { background: var(--card); border-radius: 12px; padding: 1rem; border: 1px solid #1e293b; }",
    "    article h2 { margin: 0 0 0.5rem; font-size: 1.05rem; }",
    "    .meta { font-size: 0.75rem; opacity: 0.7; }",
    "    a { color: var(--accent); text-decoration: none; }",
    "  </style>",
    "</head>",
    "<body>",
    '  <header><span class="logo">CMS</span><nav><a href="#">Editor</a> · <a href="#">Drafts</a></nav></header>',
    "  <main>",
    "    <h1>Artikel</h1>",
    '    <p class="meta">Wireframe statis — port ke komponen React/Next di bawah.</p>',
    '    <div class="grid">',
    '      <article><h2>Judul artikel contoh</h2><p class="meta">12 Mei 2026 · Penulis</p><p>Ringkasan…</p></article>',
    '      <article><h2>Draf lain</h2><p class="meta">Draft</p><p>…</p></article>',
    "    </div>",
    "  </main>",
    "</body>",
    "</html>"
  ].join("\n");

  profile.readmeMd += [
    "",
    "## Starter HTML/CSS (wireframe artikel / CMS)",
    "",
    "Salin sebagai `public/preview.html` atau jadikan referensi layout sebelum komponen Next.",
    "",
    "```html",
    htmlBlock,
    "```",
    "",
    "## Next.js (App Router) — struktur yang disarankan",
    "",
    "```text",
    "app/",
    "  layout.tsx",
    "  page.tsx                 # daftar artikel",
    "  articles/[slug]/page.tsx # detail + MDX/rich text",
    "  editor/page.tsx          # (protected) form CRUD",
    "components/",
    "  ArticleCard.tsx",
    "  RichEditor.tsx           # Tiptap / Lexical / textarea dulu",
    "lib/",
    "  articles.ts              # fetch dari API route",
    "app/api/articles/route.ts  # GET/POST (delegasi ke service backend)",
    "```",
    "",
    "### Catatan UX",
    "",
    "- **List + detail**: ISR/`revalidate` untuk halaman publik; editor pakai client component.",
    "- **Auth**: middleware Next.js + session (atau delegasi ke backend specialist).",
    "",
    lovableSection()
  ].join("\n");
}

/** Mutates `profile.readmeMd` with API + data model sketch for CMS/article backends. */
export function appendBackendWebStackReadme(profile: SpecialistAgentProfile, missionPrompt: string): void {
  const topic = missionPrompt.trim().slice(0, 80) || "articles";

  profile.readmeMd += [
    "",
    "## API & model data (artikel / CMS)",
    "",
    "### REST (contoh kontrak)",
    "",
    "```http",
    "GET    /api/v1/articles           # list + pagination ?cursor=",
    "GET    /api/v1/articles/:slug      # published only",
    "POST   /api/v1/articles            # create draft (auth)",
    "PATCH  /api/v1/articles/:id        # update body, status",
    "DELETE /api/v1/articles/:id        # soft delete",
    "```",
    "",
    "### Skema Postgres (intuisi)",
    "",
    "```sql",
    "CREATE TABLE authors (",
    "  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),",
    "  email text UNIQUE NOT NULL,",
    "  display_name text NOT NULL",
    ");",
    "",
    "CREATE TABLE articles (",
    "  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),",
    "  slug text UNIQUE NOT NULL,",
    "  title text NOT NULL,",
    "  body text NOT NULL,",
    "  status text NOT NULL CHECK (status IN ('draft','published','archived')),",
    "  author_id uuid REFERENCES authors(id),",
    "  published_at timestamptz,",
    "  created_at timestamptz DEFAULT now(),",
    "  updated_at timestamptz DEFAULT now()",
    ");",
    "CREATE INDEX idx_articles_status ON articles(status);",
    "```",
    "",
    "### Integrasi dengan frontend Next",
    "",
    "- Route handler `app/api/...` mem-proxy ke service ini **atau** Next memanggil URL backend langsung (`NEXT_PUBLIC_API_URL`).",
    `- Misi user (cuplikan): “${topic.replace(/`/g, "'")}” — sesuaikan field (kategori, tag, SEO) bila perlu.`,
    ""
  ].join("\n");
}
