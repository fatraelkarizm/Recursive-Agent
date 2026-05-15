import assert from "node:assert/strict";
import test from "node:test";
import type { MissionResult } from "../types";
import { persistMissionResult } from "./mission-store";

const missionResult: MissionResult = {
  missionId: "mission-test-1",
  status: "completed",
  profile: {
    name: "agent-test",
    role: "coding-agent",
    purpose: "Persist one mission",
    systemInstructions: "Return concise output.",
    allowedTools: ["internal-mission-log"],
    outputFormat: "markdown",
    apiKeyRefs: [],
    notes: "test mission",
    specializations: ["core-mission"],
    orchestrationMode: "local",
    skills: [],
    readmeMd: "# agent-test"
  },
  events: ["graph built", "tool route complete"]
};

test("persistMissionResult skips cleanly when no database client is available", async () => {
  const outcome = await persistMissionResult({
    prompt: "Make a coding agent",
    result: missionResult,
    db: null
  });

  assert.equal(outcome.persisted, false);
  assert.equal(outcome.reason, "DATABASE_URL is not configured");
});

test("persistMissionResult stores mission, generated profile, and ordered events", async () => {
  const calls: Array<{ method: string; args: unknown }> = [];
  const db = {
    mission: {
      upsert: async (args: unknown) => calls.push({ method: "mission.upsert", args })
    },
    specialistProfile: {
      upsert: async (args: unknown) => calls.push({ method: "specialistProfile.upsert", args })
    },
    missionEvent: {
      deleteMany: async (args: unknown) => calls.push({ method: "missionEvent.deleteMany", args }),
      createMany: async (args: unknown) => calls.push({ method: "missionEvent.createMany", args })
    }
  };

  const outcome = await persistMissionResult({
    prompt: "Make a coding agent",
    result: missionResult,
    db
  });

  assert.equal(outcome.persisted, true);
  assert.deepEqual(
    calls.map((call) => call.method),
    ["mission.upsert", "specialistProfile.upsert", "missionEvent.deleteMany", "missionEvent.createMany"]
  );
  assert.match(JSON.stringify(calls[0].args), /mission-test-1/);
  assert.match(JSON.stringify(calls[0].args), /"resultPayload"/);
  assert.match(JSON.stringify(calls[1].args), /agent-test/);
  assert.match(JSON.stringify(calls[3].args), /"sequence":0/);
  assert.match(JSON.stringify(calls[3].args), /"sequence":1/);
});
