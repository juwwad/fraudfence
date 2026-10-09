// lib/config.test.js
//
// Covers the lazy env handling in config.js. The key regression: merely
// importing config.js (which happens at the top of this file) must never
// throw when keys are missing — that import-time crash is what bypassed the
// handlers' error handling.

import { test } from "node:test"
import assert from "node:assert/strict"
import { config, getMissingEnv } from "./config.js"
import { withEnv, NO_KEYS } from "./testHelpers.js"

test("importing config.js does not throw when keys are missing", () => {
  // If the import at the top of this file had thrown, the file would never
  // have loaded. This just makes that expectation explicit.
  assert.equal(typeof config, "object")
})

test("getMissingEnv lists every missing required variable", async () => {
  await withEnv(NO_KEYS, () => {
    assert.deepEqual(getMissingEnv(), ["GROQ_API_KEY", "OPENROUTER_API_KEY"])
  })
})

test("getMissingEnv returns an empty list when both keys are set", async () => {
  await withEnv({ GROQ_API_KEY: "a", OPENROUTER_API_KEY: "b" }, () => {
    assert.deepEqual(getMissingEnv(), [])
  })
})

test("getMissingEnv treats a whitespace-only value as missing", async () => {
  await withEnv({ GROQ_API_KEY: "   ", OPENROUTER_API_KEY: "b" }, () => {
    assert.deepEqual(getMissingEnv(), ["GROQ_API_KEY"])
  })
})

test("reading a missing key throws an error naming the variable", async () => {
  await withEnv({ GROQ_API_KEY: undefined }, () => {
    assert.throws(() => config.groqApiKey, /Missing GROQ_API_KEY/)
  })
})

test("reading a set key returns it trimmed", async () => {
  await withEnv({ OPENROUTER_API_KEY: "  abc123  " }, () => {
    assert.equal(config.openRouterApiKey, "abc123")
  })
})