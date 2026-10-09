// lib/guard.js
//
// The checks every API route runs before doing any real work, kept in one
// place so analyze.js and stream.js can't drift apart (and so the logic
// isn't duplicated across them). In order: POST-only, required env vars
// present, then the per-client rate limit.
//
// Returns true when the request may proceed. Otherwise the error response
// has already been sent and it returns false, so the caller just returns.
import { checkRateLimit, getClientKey } from "./rateLimit.js"
import { getMissingEnv } from "./config.js"

export function guardRequest(req, res, { route, limitPerMinute, tooManyMessage }) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" })
    return false
  }

  // Checked here (not at import time) so a missing key produces a clean
  // JSON error instead of a raw platform crash. The variable names go to
  // the server log only, not to the client.
  const missing = getMissingEnv()
  if (missing.length > 0) {
    console.error("Missing environment variables:", missing.join(", "))
    res.status(500).json({ error: "Server is not configured correctly. Please contact the site owner." })
    return false
  }

  const rate = checkRateLimit(`${route}:${getClientKey(req)}`, {
    limit: limitPerMinute,
    windowMs: 60_000,
  })
  if (!rate.allowed) {
    res.setHeader("Retry-After", Math.ceil(rate.retryAfterMs / 1000))
    res.status(429).json({ error: tooManyMessage })
    return false
  }

  return true
}