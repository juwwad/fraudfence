// lib/rateLimit.test.js
//
// Uses an injectable `now` instead of the real clock so these run
// instantly and deterministically — no real waiting for windows to expire.

import { test } from "node:test"
import assert from "node:assert/strict"
import { checkRateLimit, resetRateLimiter, getClientKey } from "./rateLimit.js"

test("allows requests under the limit", () => {
  resetRateLimiter()
  const now = 1_000_000
  for (let i = 0; i < 5; i++) {
    const result = checkRateLimit("test-ip-a", { limit: 5, windowMs: 60_000, now })
    assert.equal(result.allowed, true)
  }
})

test("blocks the request once the limit is exceeded within the window", () => {
  resetRateLimiter()
  const now = 1_000_000
  for (let i = 0; i < 5; i++) {
    checkRateLimit("test-ip-b", { limit: 5, windowMs: 60_000, now })
  }
  const result = checkRateLimit("test-ip-b", { limit: 5, windowMs: 60_000, now })
  assert.equal(result.allowed, false)
  assert.ok(result.retryAfterMs > 0)
})

test("resets the count once the window has elapsed", () => {
  resetRateLimiter()
  const windowMs = 60_000
  const start = 1_000_000
  for (let i = 0; i < 5; i++) {
    checkRateLimit("test-ip-c", { limit: 5, windowMs, now: start })
  }
  const blocked = checkRateLimit("test-ip-c", { limit: 5, windowMs, now: start })
  assert.equal(blocked.allowed, false)

  const afterWindow = checkRateLimit("test-ip-c", { limit: 5, windowMs, now: start + windowMs + 1 })
  assert.equal(afterWindow.allowed, true)
})

test("different keys are tracked independently", () => {
  resetRateLimiter()
  const now = 1_000_000
  for (let i = 0; i < 5; i++) checkRateLimit("ip-x", { limit: 5, windowMs: 60_000, now })
  const blockedX = checkRateLimit("ip-x", { limit: 5, windowMs: 60_000, now })
  const allowedY = checkRateLimit("ip-y", { limit: 5, windowMs: 60_000, now })
  assert.equal(blockedX.allowed, false)
  assert.equal(allowedY.allowed, true)
})

test("getClientKey reads x-forwarded-for, falling back to socket address", () => {
  const reqWithHeader = { headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" }, socket: {} }
  assert.equal(getClientKey(reqWithHeader), "203.0.113.5")

  const reqWithoutHeader = { headers: {}, socket: { remoteAddress: "127.0.0.1" } }
  assert.equal(getClientKey(reqWithoutHeader), "127.0.0.1")

  const reqWithNeither = { headers: {}, socket: {} }
  assert.equal(getClientKey(reqWithNeither), "unknown")
})