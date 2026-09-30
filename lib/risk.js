// lib/risk.js
const HIGH_THRESHOLD = 60
const STRIKES = 2

// Design note: a single chunk can add at most +50 to the score
// (verdict.risk / 2, capped at risk=100). This means one maximally-risky
// chunk alone never reaches "red" (score >= 60) on its own — it takes
// two consecutive high-risk chunks to cross red, matching the STRIKES
// warning threshold. This is intentional: a single ambiguous or
// mistranscribed chunk shouldn't trigger a full red alert.

export function initialRiskState() {
  return { score: 0, consecutiveHigh: 0, lastReason: "" }
}

export function scoreChunk(state, verdict) {
  let { score, consecutiveHigh, lastReason } = state

  if (verdict.risk >= HIGH_THRESHOLD) {
    consecutiveHigh += 1
    score = Math.min(100, score + verdict.risk / 2)
    lastReason = verdict.reason
  } else {
    consecutiveHigh = 0
    score = Math.max(0, score - 10)
  }

  const newState = { score, consecutiveHigh, lastReason }
  const output = {
    score: Math.round(score),
    // green: 0-29, amber: 30-59, red: 60+ (HIGH_THRESHOLD)
    level: score >= 60 ? "red" : score >= 30 ? "amber" : "green",
    // warn fires independently of level — two consecutive high-risk
    // chunks (STRIKES) trip it even if amber, not just at red
    warn: consecutiveHigh >= STRIKES,
    reason: lastReason,
    scam_type: verdict.scam_type,
    chunkRisk: verdict.risk,
  }
  return { state: newState, output }
}