// lib/transcribe.test.js
//
// transcribe() wraps a real network call to Groq, so these tests inject a
// fake client via the optional `client` param instead of hitting the
// actual API. This verifies request shape and response parsing without
// needing a GROQ_API_KEY or real audio.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { transcribe, splitIntoChunks } from "./transcribe.js"

function makeTempAudioFile(name) {
  const filePath = path.join(os.tmpdir(), name)
  fs.writeFileSync(filePath, "fake audio bytes")
  return filePath
}

test("transcribe() auto-detects when no language hint is given", async () => {
  const calls = []
  const fakeClient = {
    audio: {
      transcriptions: {
        create: async (params) => {
          calls.push(params)
          return { text: "hello", language: "english" }
        },
      },
    },
  }

  const filePath = makeTempAudioFile("transcribe-test-1")
  try {
    const result = await transcribe(filePath, "chunk.webm", null, fakeClient)
    assert.equal(result.text, "hello")
    assert.equal(result.language, "english")
    assert.equal(calls[0].response_format, "verbose_json")
    assert.ok(!("language" in calls[0]), "should not send a language param with no hint")
  } finally {
    fs.unlinkSync(filePath)
  }
})

test("transcribe() passes a language hint through to the API when given", async () => {
  const calls = []
  const fakeClient = {
    audio: {
      transcriptions: {
        create: async (params) => {
          calls.push(params)
          return { text: "hello again", language: "urdu" }
        },
      },
    },
  }

  const filePath = makeTempAudioFile("transcribe-test-2")
  try {
    await transcribe(filePath, "chunk.webm", "ur", fakeClient)
    assert.equal(calls[0].language, "ur")
  } finally {
    fs.unlinkSync(filePath)
  }
})

test("transcribe() returns empty text and null language when API gives nothing", async () => {
  const fakeClient = { audio: { transcriptions: { create: async () => ({}) } } }
  const filePath = makeTempAudioFile("transcribe-test-3")
  try {
    const result = await transcribe(filePath, "chunk.webm", null, fakeClient)
    assert.equal(result.text, "")
    assert.equal(result.language, null)
  } finally {
    fs.unlinkSync(filePath)
  }
})

test("splitIntoChunks groups words into chunks of the given size", () => {
  const text = Array.from({ length: 85 }, (_, i) => `word${i}`).join(" ")
  const chunks = splitIntoChunks(text, 40)
  assert.equal(chunks.length, 3)
  assert.equal(chunks[0].split(" ").length, 40)
  assert.equal(chunks[2].split(" ").length, 5)
})

test("splitIntoChunks handles empty input", () => {
  assert.deepEqual(splitIntoChunks(""), [])
})