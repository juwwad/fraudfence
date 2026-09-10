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
}