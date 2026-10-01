// lib/risk.test.js
//
// Tests for the pure scoring logic in risk.js. Run with:
//   node --test lib/*.test.js
//
// This covers the score decay/cap boundaries, the green/amber/red
// level thresholds, and the two-strike "warn" logic — the parts of
// risk.js that are easy to get subtly wrong and easy to verify in
// isolation since scoreChunk() has no side effects.

import { test } from "node:test"
import assert from "node:assert/strict"
import { initialRiskState, scoreChunk } from "./risk.js"

// Small helper: build a verdict object the way judge.js would.
function verdict(risk, reason = "", scam_type = "none") {
  return { risk, reason, scam_type }
}

test("initialRiskState starts at zero with no strikes", () => {
  const state = initialRiskState()
  assert.deepEqual(state, { score: 0, consecutiveHigh: 0, lastReason: "" })
})

test("a single low-risk chunk decays score but floors at 0", () => {
  const state = initialRiskState()
  const { state: next, output } = scoreChunk(state, verdict(10, "sounds fine"))

  // score starts at 0, -10 would go negative, so it should floor at 0
  assert.equal(next.score, 0)
  assert.equal(output.score, 0)
  assert.equal(output.level, "green")
  assert.equal(output.warn, false)
})

test("repeated low-risk chunks never push score below 0", () => {
  let state = initialRiskState()
  for (let i = 0; i < 5; i++) {
    ;({ state } = scoreChunk(state, verdict(0, "fine")))
  }
  assert.equal(state.score, 0)
})

test("a single high-risk chunk adds at most +50 and stays below red", () => {
  const state = initialRiskState()
  const { state: next, output } = scoreChunk(
    state,
    verdict(100, "asked for OTP", "otp_scam")
  )

  // risk 100 / 2 = +50 added to score, capped contribution from one chunk
  assert.equal(next.score, 50)
  assert.equal(output.score, 50)
  // By design: one high-risk chunk alone should land in amber, not red —
  // see the design note in risk.js above HIGH_THRESHOLD.
  assert.equal(output.level, "amber")
  assert.equal(output.consecutiveHigh, undefined) // not exposed on output
  assert.equal(next.consecutiveHigh, 1)
})

test("two consecutive high-risk chunks cross into red and trigger warn", () => {
  let state = initialRiskState()
  let output

  ;({ state, output } = scoreChunk(state, verdict(100, "asked for OTP")))
  assert.equal(output.level, "amber")
  assert.equal(output.warn, false)

  ;({ state, output } = scoreChunk(state, verdict(100, "asked for bank PIN")))
  assert.equal(state.score, 100)
  assert.equal(output.level, "red")
  // Second consecutive high-risk chunk trips the 2-strike warning
  assert.equal(output.warn, true)
})

test("a low-risk chunk in between resets the consecutive-high strike count", () => {
  let state = initialRiskState()
  let output

  ;({ state, output } = scoreChunk(state, verdict(100, "asked for OTP")))
  assert.equal(state.consecutiveHigh, 1)

  // A single calm chunk in between should reset the strike counter to 0,
  // even though the score itself only decays by 10, not to zero.
  ;({ state, output } = scoreChunk(state, verdict(5, "just chatting")))
  assert.equal(state.consecutiveHigh, 0)
  assert.equal(state.score, 40) // 50 - 10

  ;({ state, output } = scoreChunk(state, verdict(100, "asked for OTP again")))
  assert.equal(state.consecutiveHigh, 1) // back to 1, not 2 — strike was reset
  assert.equal(output.warn, false)
})

test("score is capped at 100 even after many high-risk chunks", () => {
  let state = initialRiskState()
  for (let i = 0; i < 10; i++) {
    ;({ state } = scoreChunk(state, verdict(100, "scam talk")))
  }
  assert.equal(state.score, 100)
})

test("level boundaries: green below 30, amber 30-59, red 60+", () => {
  // Build a state sitting exactly at each boundary by chaining risk=60
  // chunks (+30 each) and checking the level at each step.
  let state = initialRiskState()
  let output

  // score 0 -> still green
  assert.equal(scoreChunk(state, verdict(0)).output.level, "green")

  // score -> 30 after one risk=60 chunk (60/2 = +30): amber boundary
  ;({ state, output } = scoreChunk(state, verdict(60, "borderline")))
  assert.equal(state.score, 30)
  assert.equal(output.level, "amber")

  // score -> 60 after a second risk=60 chunk: red boundary
  ;({ state, output } = scoreChunk(state, verdict(60, "borderline again")))
  assert.equal(state.score, 60)
  assert.equal(output.level, "red")
})

test("scam_type and reason pass through from the verdict to the output", () => {
  const state = initialRiskState()
  const { output } = scoreChunk(
    state,
    verdict(80, "requested wire transfer", "wire_fraud")
  )
  assert.equal(output.reason, "requested wire transfer")
  assert.equal(output.scam_type, "wire_fraud")
  assert.equal(output.chunkRisk, 80)
})