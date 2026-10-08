// lib/config.test.js
//
// Covers the lazy env handling in config.js. The key regression: merely
// importing config.js (which happens at the top of this file) must never
// throw when keys are missing — that import-time crash is what bypassed the
// handlers' error handling.

import { test } from "node:test"
import assert from "node:assert/strict"
import { config, getMissingEnv } from "./config.js"

// Runs fn with the given env vars set (or deleted, if the value is
// undefined), then restores the originals so tests don't leak into each other.
function withEnv(overrides, fn) {
  const saved = {}
  for (const [name, value] of Object.entries(overrides)) {
    saved[name] = process.env[name]
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  try {
    return fn()
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

test("importing config.js does not throw when keys are missing", () => {
  // If the import at the top of this file had thrown, the file would never
  // have loaded. This just makes that expectation explicit.
  assert.equal(typeof config, "object")
})

test("getMissingEnv lists every missing required variable", () => {
  withEnv({ GROQ_API_KEY: undefined, OPENROUTER_API_KEY: undefined }, () => {
    assert.deepEqual(getMissingEnv(), ["GROQ_API_KEY", "OPENROUTER_API_KEY"])
  })
})

test("getMissingEnv returns an empty list when both keys are set", () => {
  withEnv({ GROQ_API_KEY: "a", OPENROUTER_API_KEY: "b" }, () => {
    assert.deepEqual(getMissingEnv(), [])
  })
})

test("getMissingEnv treats a whitespace-only value as missing", () => {
  withEnv({ GROQ_API_KEY: "   ", OPENROUTER_API_KEY: "b" }, () => {
    assert.deepEqual(getMissingEnv(), ["GROQ_API_KEY"])
  })
})

test("reading a missing key throws an error naming the variable", () => {
  withEnv({ GROQ_API_KEY: undefined }, () => {
    assert.throws(() => config.groqApiKey, /Missing GROQ_API_KEY/)
  })
})

test("reading a set key returns it trimmed", () => {
  withEnv({ OPENROUTER_API_KEY: "  abc123  " }, () => {
    assert.equal(config.openRouterApiKey, "abc123")
  })
})