// lib/risk.test.js
//
// Tests for the pure scoring logic in risk.js. Run with:
//   node --test lib/*.test.js

import { test } from "node:test"
import assert from "node:assert/strict"
import { initialRiskState, scoreChunk } from "./risk.js"

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
  assert.equal(next.score, 50)
  assert.equal(output.score, 50)
  assert.equal(output.level, "amber")
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
  assert.equal(output.warn, true)
})

test("a low-risk chunk in between resets the consecutive-high strike count", () => {
  let state = initialRiskState()
  let output

  ;({ state, output } = scoreChunk(state, verdict(100, "asked for OTP")))
  assert.equal(state.consecutiveHigh, 1)

  ;({ state, output } = scoreChunk(state, verdict(5, "just chatting")))
  assert.equal(state.consecutiveHigh, 0)
  assert.equal(state.score, 40)

  ;({ state, output } = scoreChunk(state, verdict(100, "asked for OTP again")))
  assert.equal(state.consecutiveHigh, 1)
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
  let state = initialRiskState()
  let output

  assert.equal(scoreChunk(state, verdict(0)).output.level, "green")

  ;({ state, output } = scoreChunk(state, verdict(60, "borderline")))
  assert.equal(state.score, 30)
  assert.equal(output.level, "amber")

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

test("analysisFailed leaves score and strikes untouched, reports level 'unknown'", () => {
  const state = { score: 42, consecutiveHigh: 1, lastReason: "earlier reason" }
  const { state: next, output } = scoreChunk(state, {
    risk: 0,
    reason: "could not analyse chunk",
    scam_type: "none",
    analysisFailed: true,
  })

  assert.deepEqual(next, state)
  assert.equal(output.level, "unknown")
  assert.equal(output.score, 42)
  assert.equal(output.warn, false)
  assert.equal(output.chunkRisk, null)
})

test("analysisFailed does not reset an in-progress strike count", () => {
  let state = initialRiskState()
  ;({ state } = scoreChunk(state, verdict(100, "asked for OTP")))
  assert.equal(state.consecutiveHigh, 1)

  let output
  ;({ state, output } = scoreChunk(state, {
    risk: 0, reason: "", scam_type: "none", analysisFailed: true,
  }))
  assert.equal(state.consecutiveHigh, 1)
  assert.equal(output.level, "unknown")

  ;({ state, output } = scoreChunk(state, verdict(100, "asked for bank PIN")))
  assert.equal(output.warn, true)
})