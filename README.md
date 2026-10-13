# Fraud Fence

Fraud Fence is a lightweight browser app for detecting common phone scams in Urdu, Roman Urdu, and English call audio. It transcribes audio, evaluates the transcript for scam signals, and displays a running risk score with a spoken Urdu warning when the risk stays high.

## Features

- Analyze a recorded audio file as a timeline of risk updates.
- Listen to a microphone in 10-second chunks.
- Detect signals such as OTP/PIN requests, fake bank verification, prize scams, family emergencies, job scams, and government-payment scams.
- Back up the model with a keyword safety net that flags clear OTP, PIN,
  password or card-number requests and urgent payment demands, even if the
  model is talked into a low score.
- Show green, amber, and red risk states.
- Speak an Urdu warning after two consecutive high-risk chunks.

## Requirements

- Node.js 18+ and npm
- A Vercel account for deployment
- A Groq API key for transcription
- An OpenRouter API key for scam classification
- Microphone access for live listening

## Local development

1. Install dependencies:

```bash
   npm install
```

2. Create a `.env` file in the project root. You can copy the provided
   [`.env.example`](./.env.example) file:

```env
   GROQ_API_KEY=your_groq_api_key
   OPENROUTER_API_KEY=your_openrouter_api_key
```

   Optional model overrides:

```env
   TRANSCRIBE_MODEL=whisper-large-v3-turbo
   JUDGE_MODEL=qwen/qwen3-30b-a3b
```

   `TRANSCRIBE_MODEL` and `JUDGE_MODEL` are optional. If omitted, the
   application uses the defaults shown above. Keep API keys server-side; do
   not add them to `public/index.html` or expose them in browser code.

3. Start the local Vercel development server:

```bash
   npm run dev
```

4. Open the URL printed by Vercel, usually `http://localhost:3000`.

The browser must be served from a secure context for microphone access. `localhost` is supported by modern browsers.

## Usage

### Recorded audio

Choose an audio file in the file picker. The app sends it to `/api/analyze`, transcribes it, splits the transcript into 40-word chunks, and renders the risk timeline.

Recorded uploads are limited to 20 MB by the API function.
If transcription or scam classification fails for a chunk, the result is
shown as `unknown` rather than being treated as safe.

### Live microphone

Select **Start listening** and grant microphone access. The browser records 10-second WebM chunks and sends them to `/api/stream`. Risk state is returned by the server and kept in the browser so the stateless API can track consecutive high-risk chunks.

Live chunks are limited to 5 MB by the API function. Select **Stop listening** to end recording.
If a live chunk has no transcript, the API returns `skipped: true` and leaves
the running risk state unchanged.

## API endpoints

### `POST /api/analyze`

Accepts a multipart form upload with an `audio` field.

Successful response:

```json
{
  "transcript": "...",
  "timeline": [
    {
      "chunk": "...",
      "score": 0,
      "level": "green",
      "warn": false,
      "reason": "...",
      "scam_type": "none",
      "chunkRisk": 0
    }
  ]
}
```

### `POST /api/stream`

Accepts a multipart form upload with an `audio` field and an optional serialized `state` field.

The response includes the current transcript, risk output, and updated state. Empty transcripts return `skipped: true` without changing the state.

## Risk scoring

- A chunk risk of 60 or higher is considered high risk.
- High-risk chunks increase the running score by half their risk.
- Lower-risk chunks reduce the running score by 10 points.
- The displayed level is green below 30, amber from 30 through 59, and red at 60 or above.
- The warning is triggered after two consecutive high-risk chunks.
- A failed analysis produces an `unknown` level, preserves the score and strike
  count, and never lowers the risk.

## Keyword safety net

The model reads whatever the caller says, so a caller could try to talk it
into scoring a scam as safe. `lib/heuristics.js` is a second signal that is
plain pattern matching, so nothing a caller says can argue with it. It only
raises a score; it never lowers one.

- It flags a clear request for an OTP, PIN, password, CVV or card number
  (risk 80), and money demanded together with urgency (risk 65). Both are
  above the 60 high-risk line.
- It covers English, Roman Urdu and Urdu script, and ignores spacing tricks
  such as "O T P" and invisible characters.
- It stays quiet on safety advice such as "never share your OTP" and on
  ordinary calls, because false alarms would teach people to ignore the app.
- If the model call fails but the safety net matches, the chunk is scored
  from the match instead of being shown as `unknown`.
- It is deliberately narrow. Anything subtler is left to the model, and the
  word lists at the top of the file are meant to be extended over time.

## Deployment

1. Install the Vercel CLI if needed:

```bash
   npm install -g vercel
```

2. Link or deploy the project:

```bash
   vercel
```

3. Add `GROQ_API_KEY` and `OPENROUTER_API_KEY` to the Vercel project environment variables. Add model overrides only if you want values different from the defaults.

4. Deploy to production:

```bash
   vercel --prod
```

The Vercel function configuration gives `/api/analyze` up to 60 seconds and `/api/stream` up to 30 seconds.

## Project structure

```text
api/
  analyze.js       Recorded-file analysis endpoint
  stream.js        Live audio chunk endpoint
lib/
  config.js        Environment and model configuration
  guard.js         Shared request checks: POST-only, env vars, rate limit
  heuristics.js    Keyword safety net that backs up the model
  judge.js         Scam classification through OpenRouter
  rateLimit.js     Per-client rate limiter
  risk.js          Running risk score and warning logic
  transcribe.js    Speech transcription through Groq
public/
  index.html       Browser UI and microphone/file client
vercel.json        Vercel function limits
```

## Checks

Run the static syntax check with:

```bash
npm run build
```

Run the unit tests with:

```bash
npm test
```

No separate frontend build step is required; Vercel serves `public/index.html` directly.