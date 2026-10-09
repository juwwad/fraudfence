// api/stream.js
export const config = { api: { bodyParser: false } }

import formidable from "formidable"
import fs from "node:fs/promises"
import { transcribe } from "../lib/transcribe.js"
import { judgeChunk } from "../lib/judge.js"
import { scoreChunk, initialRiskState } from "../lib/risk.js"
import { guardRequest } from "../lib/guard.js"
import { config as appConfig } from "../lib/config.js"

export default async function handler(req, res) {
  const allowed = guardRequest(req, res, {
    route: "stream",
    limitPerMinute: appConfig.rateLimit.streamPerMinute,
    tooManyMessage: "Too many requests. Please slow down.",
  })
  if (!allowed) return

  const form = formidable({ maxFileSize: 5 * 1024 * 1024 })
  const [fields, files] = await form.parse(req)
  const audioFile = files.audio?.[0]
  if (!audioFile) return res.status(400).json({ error: "Missing audio." })

  let state
  try {
    state = fields.state?.[0] ? JSON.parse(fields.state[0]) : initialRiskState()
  } catch {
    state = initialRiskState()
  }

  // Language detected on an earlier chunk of this same live session, if
  // any. The client echoes this back on each request (see index.html) so
  // later chunks can reuse it instead of auto-detecting from scratch.
  const languageHint = fields.language?.[0] || null

  try {
    const { text: transcript, language } = await transcribe(
      audioFile.filepath,
      audioFile.originalFilename ?? "chunk.webm",
      languageHint
    )
    if (!transcript.trim()) {
      return res.status(200).json({ skipped: true, state, language: languageHint })
    }

    const verdict = await judgeChunk(transcript)
    const result = scoreChunk(state, verdict)
    res.status(200).json({
      transcript,
      ...result.output,
      state: result.state,
      language: language ?? languageHint,
    })
  } catch (error) {
    console.error("stream failed:", error.message)
    res.status(500).json({ error: "Chunk failed." })
  } finally {
    await fs.unlink(audioFile.filepath).catch(() => {})
  }
}