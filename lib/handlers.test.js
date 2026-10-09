// lib/handlers.test.js
//
// Regression tests for issue #5, at the handler level: with required env
// vars missing, each API route must answer with a clean JSON error from
// inside the handler instead of the module crashing at import time. The
// guard's own behaviour (429s, buckets, etc.) is covered in guard.test.js;
// these just confirm both routes are actually wired to it.
//
// The env check runs before the form is parsed, so no real upload is needed.

import { test } from "node:test"
import assert from "node:assert/strict"
import analyze from "../api/analyze.js"
import stream from "../api/stream.js"
import { makeReq, makeRes, withEnv, withMutedConsoleError, NO_KEYS } from "./testHelpers.js"

for (const [name, handler] of [["analyze", analyze], ["stream", stream]]) {
  test(`${name}: missing env vars return a clean 500 JSON error with no variable names`, async () => {
    await withMutedConsoleError(() =>
      withEnv(NO_KEYS, async () => {
        const res = makeRes()
        await handler(makeReq("POST"), res)
        assert.equal(res.statusCode, 500)
        assert.match(res.body.error, /not configured/i)
        assert.ok(!JSON.stringify(res.body).includes("API_KEY"))
      })
    )
  })

  test(`${name}: non-POST requests get 405`, async () => {
    const res = makeRes()
    await handler(makeReq("GET"), res)
    assert.equal(res.statusCode, 405)
  })
}