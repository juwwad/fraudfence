// lib/transcribe.js
import fs from "node:fs"
import OpenAI from "openai"
import { config } from "./config.js"

const groq = new OpenAI({
  apiKey: config.groqApiKey,
  baseURL: "https://api.groq.com/openai/v1",
})

export async function transcribe(filePath) {
  const result = await groq.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
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