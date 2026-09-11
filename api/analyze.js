// api/analyze.js
export const config = { api: { bodyParser: false } }

import formidable from "formidable"
import fs from "node:fs/promises"
import { transcribe, splitIntoChunks } from "../lib/transcribe.js"
import { judgeChunk } from "../lib/judge.js"
import { scoreChunk, initialRiskState } from "../lib/risk.js"

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" })

  const form = formidable({ maxFileSize: 20 * 1024 * 1024 })
  const [, files] = await form.parse(req)
  const audioFile = files.audio?.[0]
  if (!audioFile) return res.status(400).json({ error: "Upload an audio file." })

  try {
    const transcript = await transcribe(audioFile.filepath, audioFile.originalFilename ?? "audio.webm")
    let state = initialRiskState()
    const timeline = []

    for (const chunk of splitIntoChunks(transcript)) {
      const verdict = await judgeChunk(chunk)
      const result = scoreChunk(state, verdict)
      state = result.state
      timeline.push({ chunk, ...result.output })
    }

    res.status(200).json({ transcript, timeline })
  } catch (error) {
    console.error("analyze failed:", error.message)
    res.status(500).json({ error: "Analysis failed. Check the function logs." })
  } finally {
    await fs.unlink(audioFile.filepath).catch(() => {})
  }
}