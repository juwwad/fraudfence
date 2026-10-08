// lib/config.js
//
// Env vars are read lazily (via getters) instead of at import time.
// Previously `required()` ran while this module was being imported, so a
// missing key crashed the whole serverless function before the handler's
// own try/catch even existed, and the client got a raw platform error
// instead of a clean JSON response. Now importing this file never throws;
// handlers call getMissingEnv() up front and answer with a proper JSON
// error, and the key getters below only throw if something reads a key
// that was never set.

const REQUIRED_ENV = ["GROQ_API_KEY", "OPENROUTER_API_KEY"]

function isSet(name) {
  const value = process.env[name]
  return Boolean(value && value.trim() !== "")
}

function read(name) {
  if (!isSet(name)) {
    throw new Error(`Missing ${name}. Set it in Vercel Project Settings → Environment Variables.`)
  }
  return process.env[name].trim()
}

// Returns the names of required env vars that are missing or blank.
export function getMissingEnv() {
  return REQUIRED_ENV.filter((name) => !isSet(name))
}

export const config = {
  get groqApiKey() {
    return read("GROQ_API_KEY")
  },
  get openRouterApiKey() {
    return read("OPENROUTER_API_KEY")
  },
  transcribeModel: process.env.TRANSCRIBE_MODEL ?? "whisper-large-v3-turbo",
  judgeModel: process.env.JUDGE_MODEL ?? "qwen/qwen3-30b-a3b",
  rateLimit: {
    // Max requests per client IP per 60-second window. analyze handles
    // whole-file uploads (heavier, less frequent); stream handles 10s
    // live chunks (lighter, more frequent — a real user sends ~6/min).
    analyzePerMinute: Number(process.env.RATE_LIMIT_ANALYZE_PER_MIN ?? 10),
    streamPerMinute: Number(process.env.RATE_LIMIT_STREAM_PER_MIN ?? 15),
  },
}