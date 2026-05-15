"use client";

import { cn } from "@/lib/cn";

export type WorkspaceRecipe = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
};

const RECIPES: WorkspaceRecipe[] = [
  {
    id: "research",
    title: "Research can",
    subtitle: "Summarize sources and cite links",
    prompt: "Build a specialist that researches a topic with Tavily and returns cited bullet points."
  },
  {
    id: "code",
    title: "Engineering can",
    subtitle: "Plan refactors and small code changes",
    prompt: "Build a coding specialist that reads a bug description and proposes a minimal patch plan."
  },
  {
    id: "ops",
    title: "Ops can",
    subtitle: "Turn natural language into API steps",
    prompt: "Build an ops specialist that converts a rollout request into ordered checklist steps."
  },
  {
    id: "sales",
    title: "Sales can",
    subtitle: "Turn reviews into talking points",
    prompt: "Build a sales specialist that extracts objections and strengths from pasted customer reviews."
  },
  {
    id: "cms-web-squad",
    title: "Article CMS squad",
    subtitle: "Frontend + backend nodes + HTML/Next README",
    prompt:
      "Aku mau buat web article CMS dengan Next.js: editor artikel, daftar publikasi, dan API untuk simpan draft. Pecahkan jadi peran frontend dan backend."
  },
  {
    id: "fleet-browser",
    title: "Fleet + browser",
    subtitle: "OpenClaw orchestration + headless browser",
    prompt:
      "Use OpenClaw to orchestrate multiple sub-agents. Use Tavily to read https://nextjs.org and summarize the hero headline from extracted content."
  }
];

const INTEGRATIONS = [
  { name: "Mother agent API", detail: "POST /api/missions", tone: "text-electric" },
  { name: "Runtime config", detail: "GET /api/runtime-config (model/env, no secrets)", tone: "text-electric" },
  { name: "OpenClaw CLI", detail: "openclaw agent --json (see docs/OPENCLAW_INTEGRATION.md)", tone: "text-electric" },
  { name: "Tavily", detail: "Extract + Search (TAVILY_API_KEY)", tone: "text-electric" },
  { name: "MCP (hosted)", detail: "Wire in SETUP.md", tone: "text-slate" },
  { name: "Lovable (optional)", detail: "LOVABLE_API_KEY — README mentions API docs", tone: "text-slate" },
  { name: "Env keys", detail: ".env in frontend/backend", tone: "text-slate" }
];

type WorkspaceRailProps = {
  selectedId: string | null;
  onSelectRecipe: (recipe: WorkspaceRecipe) => void;
};

export function WorkspaceRail({ selectedId, onSelectRecipe }: WorkspaceRailProps) {
  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-white/10 bg-black/25">
      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate">Workspace</p>
        <h1 className="mt-1 text-base font-semibold text-white">Recursive Agent</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate">Pick a recipe to prefill the control chat. APIs and tools stay visible here like a workflow palette.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate">Recipes</p>
        <ul className="space-y-1">
          {RECIPES.map((recipe) => {
            const active = selectedId === recipe.id;
            return (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => onSelectRecipe(recipe)}
                  className={cn(
                    "w-full rounded-r-md border border-transparent py-2.5 pl-3 pr-2 text-left transition-colors",
                    active
                      ? "border-l-2 border-l-amber-400 bg-white/5 shadow-inner"
                      : "hover:bg-white/5"
                  )}
                >
                  <span className="text-xs font-semibold text-white">{recipe.title}</span>
                  <span className="mt-0.5 block text-[11px] text-slate">{recipe.subtitle}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mb-2 mt-6 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate">API & integrations</p>
        <ul className="space-y-2 px-2">
          {INTEGRATIONS.map((item) => (
            <li
              key={item.name}
              className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-[11px] text-slate"
            >
              <span className={`font-medium ${item.tone}`}>{item.name}</span>
              <span className="mt-0.5 block text-[10px] text-slate/90">{item.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
