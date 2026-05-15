import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { logger } from "./logging";
import { runMission } from "./agent/mother-agent";
import { getPublicRuntimeDiagnostics } from "./public-runtime-diagnostics";

const missionSchema = z.object({
  prompt: z.string().min(3)
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
