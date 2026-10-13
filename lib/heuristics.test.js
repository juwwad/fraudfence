// lib/heuristics.test.js
//
// The keyword safety net must catch clear credential requests and urgent
// payment demands in English, Roman Urdu and Urdu script, and must stay
// quiet on safety advice and ordinary calls. False alarms matter as much as
// misses here, so both directions are covered.

import { test } from "node:test"
import assert from "node:assert/strict"
import { scanHeuristics, normalizeForMatching } from "./heuristics.js"

const CREDENTIAL_REQUESTS = [
  "Please send me the OTP you just received",
  "I need your PIN number to verify your account",
  "Can you tell me your card number and CVV",
  "what is your password",
  "send me your pin",
  "Hello sir. Please read me the OTP.",
  "Aap ka OTP bata dein",
  "apna pin number bhej do",
  "card ka number batayen",
  "OTP chahiye jo aapko abhi aaya hai",
  "atm pin bhej do",
  "اپنا او ٹی پی بتائیں",
  "آپ کا پاسورڈ بتا دیں",
  "کارڈ نمبر بھیجیں",
]

const URGENT_PAYMENTS = [
  "Send the money right now",
  "Transfer the amount immediately to this account",
  "abhi paisay bhej do",
  "foran raqam bhejein",
  "jazzcash par abhi paisay bhejein",
  "ابھی رقم بھیجیں",
]

const SAFETY_ADVICE = [
  "Never share your OTP with anyone",
  "The bank will never ask for your PIN",
  "Do not give your password to anyone",
  "Your OTP is 4821, do not share it with anyone",
  "Bank kabhi OTP nahi maangta",
  "OTP kisi ko mat batayen",
  "OTP share na karein",
  "اپنا او ٹی پی کسی کو نہ بتائیں",
  "بینک کبھی پن نہیں مانگتا",
]

const ORDINARY_CALLS = [
  "",
  "Hello, this is your courier, your parcel arrives tomorrow",
  "Assalam o alaikum, aap kaise hain",
  "Your payment has been received, thank you",
  "Meeting at three, send me the report",
  "I will send the money to you tomorrow",
  "Please pin this message and send it to everyone",
  "Your account number ends in 1234",
]

for (const text of CREDENTIAL_REQUESTS) {
  test(`flags a credential request: ${text}`, () => {
    const result = scanHeuristics(text)
    assert.equal(result?.scam_type, "credential_request")
    assert.equal(result.risk, 80)
  })
}

for (const text of URGENT_PAYMENTS) {
  test(`flags an urgent payment demand: ${text}`, () => {
    const result = scanHeuristics(text)
    assert.equal(result?.scam_type, "urgent_payment")
    assert.equal(result.risk, 65)
  })
}

for (const text of [...SAFETY_ADVICE, ...ORDINARY_CALLS]) {
  test(`stays quiet on: ${text || "(empty text)"}`, () => {
    assert.equal(scanHeuristics(text), null)
  })
}

test("catches an OTP request spelled out with spaces", () => {
  assert.equal(scanHeuristics("share your O T P with me")?.scam_type, "credential_request")
})

test("catches lookalike spellings: zero-width characters and Arabic letter forms", () => {
  assert.equal(scanHeuristics("send\u200B me the O\u200BTP")?.scam_type, "credential_request")
  assert.equal(scanHeuristics("اپنا او ٹي پي بتائیں")?.scam_type, "credential_request")
})

test("advice in one sentence does not hide a request in the next", () => {
  const result = scanHeuristics("Never share your OTP. But please tell me the OTP now.")
  assert.equal(result?.scam_type, "credential_request")
})

test("punctuation after 'do not' means it is not treated as advice", () => {
  assert.equal(scanHeuristics("do not worry, just share your OTP")?.scam_type, "credential_request")
})

test("the strongest match wins when both rules apply", () => {
  const result = scanHeuristics("Send the money right now and tell me your PIN number")
  assert.equal(result.scam_type, "credential_request")
  assert.equal(result.risk, 80)
})

test("every score is at or above risk.js's high-risk line of 60", () => {
  for (const text of [...CREDENTIAL_REQUESTS, ...URGENT_PAYMENTS]) {
    assert.ok(scanHeuristics(text).risk >= 60)
  }
})

test("normalizeForMatching handles missing input", () => {
  assert.equal(normalizeForMatching(undefined), "")
  assert.equal(normalizeForMatching(null), "")
})