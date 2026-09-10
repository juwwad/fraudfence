// lib/risk.js
const HIGH_THRESHOLD = 60
const STRIKES = 2

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
    level: score >= 60 ? "red" : score >= 30 ? "amber" : "green",
    warn: consecutiveHigh >= STRIKES,
    reason: lastReason,
    scam_type: verdict.scam_type,
    chunkRisk: verdict.risk,
  }
  return { state: newState, output }
}