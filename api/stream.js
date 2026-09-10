// api/stream.js
export const config = { api: { bodyParser: false } }

import formidable from "formidable"
import fs from "node:fs/promises"
import { transcribe } from "../lib/transcribe.js"
import { judgeChunk } from "../lib/judge.js"
import { scoreChunk, initialRiskState } from "../lib/risk.js"

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" })

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

  try {
    const transcript = await transcribe(audioFile.filepath)
    if (!transcript.trim()) return res.status(200).json({ skipped: true, state })

    const verdict = await judgeChunk(transcript)
    const result = scoreChunk(state, verdict)
    res.status(200).json({ transcript, ...result.output, state: result.state })
  } catch (error) {
    console.error("stream failed:", error.message)
    res.status(500).json({ error: "Chunk failed." })
  } finally {
    await fs.unlink(audioFile.filepath).catch(() => {})
  }
}