// lib/handlers.test.js
//
// Regression tests for issue #5: with required env vars missing, the API
// handlers must answer with a clean JSON error from inside the handler,
// instead of the module crashing at import time.
//
// These use a minimal fake req/res. The env check runs before the form is
// parsed, so no real upload is needed.

import { test } from "node:test"
import assert from "node:assert/strict"
import analyze from "../api/analyze.js"
import stream from "../api/stream.js"

function makeRes() {
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

function makeReq(method = "POST") {
  return { method, headers: {}, socket: {} }
}

// Runs fn with the required keys removed, silencing the expected
// console.error output, then restores everything.
async function withoutKeys(fn) {
  const saved = {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  }
  const originalConsoleError = console.error
  delete process.env.GROQ_API_KEY
  delete process.env.OPENROUTER_API_KEY
  console.error = () => {}
  try {
    await fn()
  } finally {
    console.error = originalConsoleError
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

for (const [name, handler] of [["analyze", analyze], ["stream", stream]]) {
  test(`${name}: missing env vars return a clean 500 JSON error`, async () => {
    await withoutKeys(async () => {
      const res = makeRes()
      await handler(makeReq("POST"), res)
      assert.equal(res.statusCode, 500)
      assert.match(res.body.error, /not configured/i)
    })
  })

  test(`${name}: the error response does not leak variable names`, async () => {
    await withoutKeys(async () => {
      const res = makeRes()
      await handler(makeReq("POST"), res)
      assert.ok(!JSON.stringify(res.body).includes("GROQ_API_KEY"))
      assert.ok(!JSON.stringify(res.body).includes("OPENROUTER_API_KEY"))
    })
  })

  test(`${name}: non-POST requests still get 405 before any env check`, async () => {
    const res = makeRes()
    await handler(makeReq("GET"), res)
    assert.equal(res.statusCode, 405)
  })
}