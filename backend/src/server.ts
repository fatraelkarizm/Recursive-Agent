import path from "node:path";
import { config as loadEnv } from "dotenv";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { logger } from "./logging";
import { runMission } from "./agent/mother-agent";
import { tavilyExtractOne } from "./capabilities/tavily-extract-one";
import { getPublicRuntimeDiagnostics } from "./public-runtime-diagnostics";

// Load `backend/.env` even when npm runs the script with cwd = monorepo root (`dotenv/config` alone only reads cwd).
const backendEnvPath = path.resolve(__dirname, "..", ".env");
loadEnv({ path: backendEnvPath });
loadEnv();

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

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  logger.info(`Backend running on http://localhost:${port}`);
});
