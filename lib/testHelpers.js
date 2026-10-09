// lib/testHelpers.js
//
// Shared helpers for the test files. Not named *.test.js, so `node --test`
// doesn't try to run it as a test itself.

// Minimal fake of the Vercel/Node response object that records what the
// handler did with it.
export function makeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
    setHeader(name, value) {
      this.headers[name] = value
    },
  }
}

export function makeReq(method = "POST", headers = {}) {
  return { method, headers, socket: {} }
}

// Runs fn with the given env vars set (or deleted, when the value is
// undefined), then restores the originals so tests don't leak into each
// other. Always `await` it.
export async function withEnv(overrides, fn) {
  const saved = {}
  for (const [name, value] of Object.entries(overrides)) {
    saved[name] = process.env[name]
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  try {
    return await fn()
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

// Silences console.error while fn runs, for code paths that log an
// expected error.
export async function withMutedConsoleError(fn) {
  const original = console.error
  console.error = () => {}
  try {
    return await fn()
  } finally {
    console.error = original
  }
}

export const NO_KEYS = { GROQ_API_KEY: undefined, OPENROUTER_API_KEY: undefined }
export const FAKE_KEYS = { GROQ_API_KEY: "test-key", OPENROUTER_API_KEY: "test-key" }