import assert from "node:assert/strict";
import test from "node:test";
import { buildEffectiveMissionPrompt } from "./mission-prompt";
import type { MissionPayload } from "../types";

test("buildEffectiveMissionPrompt merges notes and urls", () => {
  const payload: MissionPayload = {
    prompt: "Build a specialist",
    contextNotes: "Use polite tone.",
    referenceUrls: ["https://a.example/x", "not-a-url", "https://b.example/y"],
    preferTavilySearch: true
  };
  const s = buildEffectiveMissionPrompt(payload);
  assert.ok(s.startsWith("Build a specialist"));
  assert.ok(s.includes("## Konteks / pengetahuan"));
  assert.ok(s.includes("Use polite tone."));
  assert.ok(s.includes("https://a.example/x"));
  assert.ok(s.includes("https://b.example/y"));
  assert.ok(!s.includes("not-a-url"));
  assert.ok(s.includes("Tavily web search"));
});

test("buildEffectiveMissionPrompt includes mother review", () => {
  const payload: MissionPayload = {
    prompt: "Go",
    motherReviewNotes: "Please add tests."
  };
  const s = buildEffectiveMissionPrompt(payload);
  assert.ok(s.includes("## Review / uji dari user"));
  assert.ok(s.includes("Please add tests."));
});
