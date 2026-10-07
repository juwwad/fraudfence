// lib/config.js
function required(name) {
  const value = process.env[name]
  if (!value || value.trim() === "") {
    throw new Error(`Missing ${name}. Set it in Vercel Project Settings → Environment Variables.`)
  }
  return value.trim()
}

export const config = {
  groqApiKey: required("GROQ_API_KEY"),
  openRouterApiKey: required("OPENROUTER_API_KEY"),
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