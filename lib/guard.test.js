// lib/guard.test.js
//
// guardRequest() is the shared pre-flight for both API routes: POST-only,
// env vars present, then the per-client rate limit.

import { test } from "node:test"
import assert from "node:assert/strict"
import { guardRequest } from "./guard.js"
import { resetRateLimiter } from "./rateLimit.js"
import { makeReq, makeRes, withEnv, withMutedConsoleError, NO_KEYS, FAKE_KEYS } from "./testHelpers.js"

const OPTIONS = { route: "test-route", limitPerMinute: 2, tooManyMessage: "slow down" }

test("rejects non-POST requests with 405", () => {
  const res = makeRes()
  assert.equal(guardRequest(makeReq("GET"), res, OPTIONS), false)
  assert.equal(res.statusCode, 405)
})

test("rejects with a clean 500 when env vars are missing, without naming them", async () => {
  await withMutedConsoleError(() =>
    withEnv(NO_KEYS, () => {
      const res = makeRes()
      assert.equal(guardRequest(makeReq(), res, OPTIONS), false)
      assert.equal(res.statusCode, 500)
      assert.match(res.body.error, /not configured/i)
      assert.ok(!JSON.stringify(res.body).includes("API_KEY"))
    })
  )
})

test("lets a valid request through without sending any response", async () => {
  resetRateLimiter()
  await withEnv(FAKE_KEYS, () => {
    const res = makeRes()
    assert.equal(guardRequest(makeReq(), res, OPTIONS), true)
    assert.equal(res.statusCode, null)
  })
})

test("returns 429 with a Retry-After header once the limit is exceeded", async () => {
  resetRateLimiter()
  await withEnv(FAKE_KEYS, () => {
    const req = makeReq("POST", { "x-forwarded-for": "203.0.113.9" })
    assert.equal(guardRequest(req, makeRes(), OPTIONS), true)
    assert.equal(guardRequest(req, makeRes(), OPTIONS), true)

    const res = makeRes()
    assert.equal(guardRequest(req, res, OPTIONS), false)
    assert.equal(res.statusCode, 429)
    assert.equal(res.body.error, "slow down")
    assert.ok(res.headers["Retry-After"] > 0)
  })
})

test("different routes keep separate rate-limit buckets for the same client", async () => {
  resetRateLimiter()
  await withEnv(FAKE_KEYS, () => {
    const req = makeReq("POST", { "x-forwarded-for": "203.0.113.10" })
    const oneAllowed = { ...OPTIONS, limitPerMinute: 1 }
    assert.equal(guardRequest(req, makeRes(), { ...oneAllowed, route: "route-a" }), true)
    assert.equal(guardRequest(req, makeRes(), { ...oneAllowed, route: "route-a" }), false)
    assert.equal(guardRequest(req, makeRes(), { ...oneAllowed, route: "route-b" }), true)
  })
})