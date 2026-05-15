import assert from "node:assert/strict";
import { test } from "node:test";
import { getPublicRuntimeDiagnostics } from "./public-runtime-diagnostics";

test("getPublicRuntimeDiagnostics returns shape without leaking keys", () => {
  const d = getPublicRuntimeDiagnostics();
  assert.equal(typeof d.generatedAt, "string");
  assert.ok(d.disclaimer.length > 10);
  assert.equal(typeof d.llmGateway.openAiCompat.configured, "boolean");
  assert.ok(["OPENAI_COMPAT_API_KEY", "DEEPSEEK_API_KEY", "none"].includes(d.llmGateway.openAiCompat.bearerFrom));
  const json = JSON.stringify(d);
  assert.ok(!json.includes("sk-"), "must not echo common key prefix");
});
