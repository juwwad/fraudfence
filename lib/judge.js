// lib/judge.js
import OpenAI from "openai"
import { config } from "./config.js"

const openrouter = new OpenAI({
  apiKey: config.openRouterApiKey,
  baseURL: "https://openrouter.ai/api/v1",
})

const SYSTEM_PROMPT = `You detect phone scams in Urdu, Roman Urdu and English call transcripts.
Common local scams: OTP/PIN phishing, fake prize or lucky draw, fake bank or helpline verification,
fake family emergency, fake job offer, benazir/government payment scams.

Reply with ONLY a JSON object, no prose, no markdown:
{"risk": <0-100>, "reason": "<max 12 words, plain English>", "scam_type": "<snake_case or none>"}

Be conservative. Ordinary bank, courier and family calls must score below 30.
Only score above 60 when someone requests an OTP, PIN, password, card number,
or pressures the listener to send money or act immediately.`

const SAFE_FALLBACK = { risk: 0, reason: "could not analyse chunk", scam_type: "none" }

export async function judgeChunk(chunk) {
  try {
    const response = await openrouter.chat.completions.create({
      model: config.judgeModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: chunk },
      ],
    })
    return normalise(response.choices[0]?.message?.content)
  } catch (error) {
    console.error("judge failed:", error.message)
    return SAFE_FALLBACK
  }
}

function normalise(raw) {
  if (!raw) return SAFE_FALLBACK
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return SAFE_FALLBACK
  try {
    const parsed = JSON.parse(match[0])
    return {
      risk: Math.min(100, Math.max(0, Number(parsed.risk) || 0)),
      reason: String(parsed.reason ?? "no reason given").slice(0, 120),
      scam_type: String(parsed.scam_type ?? "none"),
    }
  } catch {
    return SAFE_FALLBACK
  }
}