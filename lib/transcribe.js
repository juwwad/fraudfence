// lib/transcribe.js
import fs from "node:fs"
import OpenAI, { toFile } from "openai"
import { config } from "./config.js"

const groq = new OpenAI({
  apiKey: config.groqApiKey,
  baseURL: "https://api.groq.com/openai/v1",
})

// formidable writes uploads to an extensionless /tmp path, so Groq's SDK can't
// guess the audio format from the filename and rejects it. toFile() lets us
// attach an explicit filename (with the right extension) to the upload
// without needing to rename the actual file on disk.
export async function transcribe(filePath, originalFilename = "audio.webm") {
  const result = await groq.audio.transcriptions.create({
    file: await toFile(fs.createReadStream(filePath), originalFilename),
    model: config.transcribeModel,
    language: "ur",
    response_format: "json",
  })
  return result.text ?? ""
}

export function splitIntoChunks(text, wordsPerChunk = 40) {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "))
  }
  return chunks
}