// lib/rateLimit.js
//
// A lightweight, zero-dependency, fixed-window rate limiter for Vercel's
// serverless functions.
//
// IMPORTANT CAVEAT: state lives in this module's in-memory Map, which is
// scoped to a single warm container instance. Vercel can run multiple
// instances concurrently under load, and a cold start wipes this Map
// entirely — so this does NOT guarantee a hard global cap across all
// traffic hitting the app. What it DOES do: stop the common abuse case
// of a single client hammering the same warm instance in a tight loop,
// at zero cost and zero new infrastructure.
//
// A true cross-instance guarantee needs a shared store (e.g. Vercel KV,
// Upstash Redis) — worth upgrading to if abuse becomes a real problem
// in practice.

const buckets = new Map()
let callsSinceSweep = 0
const SWEEP_EVERY = 500

function sweep(now, windowMs) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= windowMs) buckets.delete(key)
  }
}

// key: a string identifying the client (see getClientKey below).
// limit: max requests allowed within windowMs.
// windowMs: fixed window length, in milliseconds.
// now: injectable for tests; defaults to the real clock.
export function checkRateLimit(key, { limit, windowMs, now = Date.now() }) {
  callsSinceSweep += 1
  if (callsSinceSweep >= SWEEP_EVERY) {
    sweep(now, windowMs)
    callsSinceSweep = 0
  }

  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 }
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - bucket.windowStart) }
  }

  bucket.count += 1
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 }
}

// Test-only helper: clears all tracked buckets so tests don't bleed
// state into each other via this module's shared Map.
export function resetRateLimiter() {
  buckets.clear()
  callsSinceSweep = 0
}

// Vercel sets x-forwarded-for to the real client IP (possibly a comma-
// separated list if multiple proxies are involved — the first entry is
// the original client). Falls back to the raw socket address, then to
// "unknown" if neither is available (e.g. a bare mock req in tests).
export function getClientKey(req) {
  const forwarded = req.headers?.["x-forwarded-for"]
  if (forwarded) return forwarded.split(",")[0].trim()
  return req.socket?.remoteAddress || "unknown"
}