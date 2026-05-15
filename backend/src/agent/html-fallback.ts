/** Minimal standalone HTML when LLM gateway fails (still enables Live preview). */
export function buildFallbackHtmlDeliverable(missionPrompt: string): string {
  const topic = /crypto|bitcoin|ethereum|web3/i.test(missionPrompt)
    ? "Crypto"
    : /landing/i.test(missionPrompt)
      ? "Landing"
      : "Product";

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${topic} — Mother fallback</title>
  <style>
    :root { --bg:#050b14; --card:#0f1c2e; --accent:#64ffda; --text:#e8f0ff; --muted:#8ba3c7; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    header { padding: 4rem 1.5rem 3rem; text-align: center; background: radial-gradient(ellipse at top, #1a3a5c 0%, var(--bg) 70%); }
    h1 { font-size: clamp(2rem, 5vw, 3rem); margin-bottom: 0.75rem; }
    h1 span { color: var(--accent); }
    p.lead { color: var(--muted); max-width: 42rem; margin: 0 auto 1.5rem; }
    .cta { display: inline-block; padding: 0.85rem 1.75rem; background: var(--accent); color: #041018; font-weight: 700; border-radius: 999px; text-decoration: none; }
    section { max-width: 960px; margin: 0 auto; padding: 3rem 1.5rem; }
    .grid { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .card { background: var(--card); border: 1px solid rgba(100,255,218,0.15); border-radius: 12px; padding: 1.25rem; }
    .card h3 { color: var(--accent); font-size: 1rem; margin-bottom: 0.5rem; }
    footer { text-align: center; padding: 2rem; color: var(--muted); font-size: 0.85rem; }
  </style>
</head>
<body>
  <header>
    <h1><span>${topic}</span> untuk masa depan digital</h1>
    <p class="lead">Halaman fallback — gateway LLM timeout/abort. Jalankan ulang misi setelah SumoPod/qwen stabil.</p>
    <a class="cta" href="#fitur">Mulai sekarang</a>
  </header>
  <section id="fitur">
    <div class="grid">
      <article class="card"><h3>Aman</h3><p>Infrastruktur modern.</p></article>
      <article class="card"><h3>Cepat</h3><p>Onboarding menit.</p></article>
      <article class="card"><h3>Global</h3><p>Multi-aset.</p></article>
    </div>
  </section>
  <footer>Recursive Agent · fallback HTML</footer>
</body>
</html>`;

  return ["```html", html, "```"].join("\n");
}
