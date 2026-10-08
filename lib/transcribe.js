// lib/transcribe.js
import fs from "node:fs"
import OpenAI, { toFile } from "openai"
import { config } from "./config.js"

// The Groq client is created on first use, not at import time, so a
// missing GROQ_API_KEY can't crash the module while it's being loaded
// (see the note at the top of config.js).
let groqClient = null
function getGroq() {
  if (!groqClient) {
    groqClient = new OpenAI({
      apiKey: config.groqApiKey,
      baseURL: "https://api.groq.com/openai/v1",
    })
  }
  return groqClient
}

// formidable writes uploads to an extensionless /tmp path, so Groq's SDK can't
// guess the audio format from the filename and rejects it. toFile() lets us
// attach an explicit filename (with the right extension) to the upload
// without needing to rename the actual file on disk.
//
// languageHint (optional): passed straight through as the `language` param
// when provided. Used by the live-streaming flow (api/stream.js) to reuse
// the language detected on an EARLIER chunk of the same call, since short
// 10s chunks are more prone to language-detection errors than a full
// recording. File-mode (api/analyze.js) has no prior chunk to learn from,
// so it always auto-detects.
//
// response_format is "verbose_json" (not "json") so Groq returns the
// detected `language` alongside the text.
//
// client (optional): lets tests inject a fake client instead of hitting the
// network. The real client is only created when no client is passed in.
export async function transcribe(filePath, originalFilename = "audio.webm", languageHint = null, client = getGroq()) {
  const result = await client.audio.transcriptions.create({
    file: await toFile(fs.createReadStream(filePath), originalFilename),
    model: config.transcribeModel,
    response_format: "verbose_json",
    ...(languageHint ? { language: languageHint } : {}),
  })
  return { text: result.text ?? "", language: result.language ?? null }
}

export function splitIntoChunks(text, wordsPerChunk = 40) {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "))
  }
  return chunks
}