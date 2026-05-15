import path from "node:path";
import fs from "node:fs";
import { config as loadEnv } from "dotenv";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { logger } from "./logging";
import { runMission } from "./agent/mother-agent";
import { tavilyExtractOne } from "./capabilities/tavily-extract-one";
import { getPublicRuntimeDiagnostics } from "./public-runtime-diagnostics";
import { listCanvasAgents, updateCanvasAgentPosition } from "./db/agent-store";

// Load env robustly:
// - sometimes the server is started from repo root vs from `backend/`
// - sometimes shells already define OPENAI_COMPAT_* as empty, so dotenv must override
// Try multiple candidate paths and apply all that exist.
const envCandidates = [
  // backend/src/server.ts -> backend/.env
  path.resolve(__dirname, "..", ".env"),
  // repoRoot/.env (optional)
  path.resolve(process.cwd(), ".env"),
  // repoRoot/backend/.env (most common when started from root)
  path.resolve(process.cwd(), "backend", ".env"),
];

for (const p of envCandidates) {
  if (!fs.existsSync(p)) continue;
  loadEnv({ path: p, override: true });
}

const missionSchema = z.object({
  prompt: z.string().min(3),
  contextNotes: z.string().max(32000).optional(),
  referenceUrls: z.array(z.string().max(2048)).max(16).optional(),
  preferTavilySearch: z.boolean().optional(),
  motherReviewNotes: z.string().max(16000).optional()
});

const previewExtractSchema = z.object({
  url: z.string().min(8).max(2048),
  query: z.string().max(500).optional()
});

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "autonomous-architect-backend" });
});

/** Safe worker/env snapshot for dashboard "Config" tab (no secret values). */
app.get("/api/runtime-config", (_req, res) => {
  res.json(getPublicRuntimeDiagnostics());
});

const canvasPositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

/** Persist React Flow node position for a canvas agent. */
app.patch("/api/agents/:id/position", async (req, res) => {
  const parsed = canvasPositionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid position" });
  }
  const id = String(req.params.id ?? "").trim();
  if (!id) return res.status(400).json({ message: "Missing agent id" });

  try {
    const ok = await updateCanvasAgentPosition(id, parsed.data);
    if (!ok) return res.status(404).json({ message: "Agent not found or DB unavailable" });
    return res.json({ ok: true });
  } catch (error) {
    logger.error({ error, id }, "Failed to update canvas position");
    return res.status(500).json({ message: "Failed to save position" });
  }
});

/** All persisted canvas agents (survives page refresh). */
app.get("/api/agents", async (_req, res) => {
  try {
    const agents = await listCanvasAgents();
    return res.json({
      agents: agents.map((a) => ({
        id: a.id,
        missionId: a.missionId,
        createdAt: a.createdAt,
        profile: a.profile
      }))
    });
  } catch (error) {
    logger.error({ error }, "Failed to list canvas agents");
    return res.status(500).json({ message: "Failed to load agents" });
  }
});

/** Tavily Extract preview for Mother dashboard "Services" tab (requires TAVILY_API_KEY). */
app.post("/api/preview-extract", async (req, res) => {
  const parsed = previewExtractSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }
  const out = await tavilyExtractOne({
    url: parsed.data.url.trim(),
    query: parsed.data.query?.trim()
  });
  if (!out.ok) {
    return res.status(200).json({ ok: false, error: out.error });
  }
  return res.json({
    ok: true,
    url: out.url,
    title: out.title,
    markdown: out.markdown,
    credits: out.credits
  });
});

app.post("/api/missions", async (req, res) => {
  const parsed = missionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  try {
    const result = await runMission(parsed.data);
    return res.json(result);
  } catch (error) {
    logger.error({ error }, "Mission execution failed");
    return res.status(500).json({ message: "Mission failed" });
  }
});

/** SSE: live Mother phases (thought cloud) + final MissionResult on `done`. */
app.post("/api/missions/stream", async (req, res) => {
  const parsed = missionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  req.setTimeout(0);
  res.setTimeout(600_000);
  res.flushHeaders?.();

  const write = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const safeWrite = (event: string, data: unknown) => {
    if (res.writableEnded) return;
    write(event, data);
  };

  const missionPromise = runMission(parsed.data, (progress) => {
    safeWrite("progress", progress);
  });

  try {
    const result = await missionPromise;
    safeWrite("done", result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission failed";
    logger.error({ error }, "Mission stream failed");
    safeWrite("error", { message });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  logger.info(`Backend running on http://localhost:${port}`);
});
