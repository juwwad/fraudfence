// lib/heuristics.js
//
// A second scam signal that does NOT depend on the language model.
//
// Why it exists: the model reads whatever the caller says, so a caller can
// try to talk it into scoring the call as safe (prompt injection). judge.js
// delimits the transcript to make that harder, but no prompt can guarantee
// it. This scanner is plain pattern matching, so nothing a caller says can
// argue with it. judge.js uses its result as a FLOOR under the model's
// score: it can raise a verdict, never lower one.
//
// It is deliberately narrow. A false alarm on a genuine bank or courier
// call would teach people to ignore the app, so it only fires on a clear
// request for a credential, or on money being demanded urgently, and it
// stays quiet on safety advice such as "never share your OTP". Anything
// subtler is left to the model.
//
// The word lists below are plain arrays so they are easy to extend. Roman
// Urdu is spelled many ways, so expect to add variants over time.

// Both scores are at or above the "high risk" line in risk.js (60); a
// floor below it would have no effect on the running score.
const CREDENTIAL_RISK = 80
const URGENT_PAYMENT_RISK = 65

// ---- word lists (regex fragments, matched case-insensitively) ----

const CREDENTIAL_ITEMS = [
  String.raw`o\s*t\s*p`,
  String.raw`one[\s-]*time[\s-]*(?:password|pin|code|passcode)`,
  // A bare "pin" also means a physical pin, so it needs a possessive or
  // qualifier next to it ("your pin", "atm pin", "pin code").
  String.raw`(?:your|my|the|atm|card|apna|apni|aapka|aap\s+ka|mera|meri|ka|ki)\s+pin`,
  String.raw`pin[\s-]*(?:code|number|no)`,
  "password", "passcode", "cvv", "cvc",
  String.raw`card\s+(?:ka\s+)?(?:number|no)`,
  // Urdu script
  String.raw`او\s*ٹی\s*پی`,
  String.raw`(?:اپنا|اپنی|آپ\s+کا|آپ\s+کی|کا|کی|میرا)\s+پن`,
  String.raw`پن\s+(?:کوڈ|نمبر)`,
  String.raw`پاس\s*ورڈ`,
  String.raw`کارڈ\s+(?:کا\s+)?نمبر`,
]

const CREDENTIAL_CUES = [
  "send", "share", "tell", "give", "read", "provide", "confirm", "verify",
  "enter", "forward", "say", "need", "needs", "required?",
  String.raw`what(?:'s|\s+is)`, "whats",
  // Roman Urdu
  String.raw`bata\w*`, String.raw`bhej\w*`, String.raw`de\s*do`, "dedo", "dijiye",
  "dijiyega", "den", "dein", "chahiye", "chahie", "chaiye", "zaroorat",
  String.raw`kya\s+(?:hai|he)`, String.raw`bol\w*`, String.raw`likh\w*`,
  String.raw`(?:share|send|confirm|verify)\s+kar\w*`,
  // Urdu script
  String.raw`بتا\p{L}*`, String.raw`بھیج\p{L}*`, "دیں", "دیجیے", "دیجئے",
  "چاہیے", "چاہئے", String.raw`کیا\s+ہے`, String.raw`بول\p{L}*`, "شیئر", "کنفرم",
]

const MONEY_ITEMS = [
  "money", "cash", "payment", "amount", "paisay", "paise", "paisa", "raqam",
  "rupay", "rupees", String.raw`easy\s*paisa`, String.raw`jazz\s*cash`,
  "رقم", "پیسے", "پیسہ", "روپے", String.raw`ایزی\s*پیسہ`, String.raw`جاز\s*کیش`,
]

const PAYMENT_CUES = [
  "send", "transfer", "pay", "deposit", "wire", String.raw`bhej\w*`,
  String.raw`transfer\s+kar\w*`, String.raw`jama\w*`, String.raw`de\s*do`,
  "dedo", "dein", "den", String.raw`بھیج\p{L}*`, "ٹرانسفر", "جمع", "دیں",
]

const URGENCY = [
  "now", "immediately", String`right\s+away`, String.raw`urgent(?:ly)?`,
  "asap", "quickly", "abhi", "foran", "fauran", "jaldi", "turant",
  "فورا", "فوری", "ابھی", "جلدی",
]

// Safety advice, not a request: "never share your OTP", "OTP kisi ko mat
// batayen". A sentence containing one of these is skipped. Words may sit
// between the "never" and the verb, but only plain words: a comma or other
// punctuation ends the gap, so "do not worry, just share your OTP" is NOT
// treated as advice.
const GAP = String.raw`(?:[\p{L}\p{N}']+\s+){0,3}`
const SHARING_VERBS =
  "share|tell|give|send|reveal|disclose|provide|read|ask|asks|asking|request|requests|requesting"

const ADVICE_PHRASES = [
  String.raw`(?:never|do\s+not|don't|dont|doesn't|does\s+not|should\s+not|shouldn't|must\s+not|will\s+not|won't)\s+${GAP}(?:${SHARING_VERBS})`,
  // Roman Urdu
  String.raw`kabhi\s+${GAP}(?:nahi|nahin|nai|na)`,
  String.raw`(?:nahi|nahin|na|mat)\s+${GAP}(?:bata\w*|share|bhej\w*|dein|den|btayen)`,
  String.raw`kisi\s+ko\s+(?:na|mat|nahi|nahin)`,
  String.raw`(?:share|send)\s+(?:na|mat|nahi|nahin)\s+kar\w*`,
  String.raw`nahin?\s+(?:maangta|mangta|poochta|puchta|maangte|mangte)`,
  // Urdu script
  String.raw`کبھی\s+${GAP}(?:نہیں|نہ)`,
  String.raw`(?:نہیں|نہ|مت)\s+${GAP}(?:بتا\p{L}*|شیئر|دیں|بھیج\p{L}*|دیجیے|دیجئے)`,
  String.raw`کسی\s+کو\s+(?:نہ|مت|نہیں)`,
]

// ---- matching ----

// Whole-word match that also works for Urdu script (\b only understands
// ASCII letters).
const word = (alternatives) =>
  String.raw`(?<![\p{L}\p{N}])(?:${alternatives.join("|")})(?![\p{L}\p{N}])`

const anyOf = (alternatives) => new RegExp(word(alternatives), "iu")

// Two terms within six words of each other, in either order ("send me
// your OTP", "aap ka OTP bata dein").
function near(first, second) {
  const gap = String.raw`(?:\S+\s+){0,6}?`
  const a = word(first)
  const b = word(second)
  return new RegExp(String.raw`${a}\s+${gap}${b}|${b}\s+${gap}${a}`, "iu")
}

const CREDENTIAL_REQUEST = near(CREDENTIAL_ITEMS, CREDENTIAL_CUES)
const PAYMENT_DEMAND = near(MONEY_ITEMS, PAYMENT_CUES)
const URGENT = anyOf(URGENCY)
const ADVICE = anyOf(ADVICE_PHRASES)

const RULES = [
  {
    risk: CREDENTIAL_RISK,
    reason: "Caller is asking for a PIN, OTP, password or card details",
    scam_type: "credential_request",
    matches: (sentence) => CREDENTIAL_REQUEST.test(sentence),
  },
  {
    risk: URGENT_PAYMENT_RISK,
    reason: "Caller is pressuring you to send money quickly",
    scam_type: "urgent_payment",
    matches: (sentence) => PAYMENT_DEMAND.test(sentence) && URGENT.test(sentence),
  },
]

// Makes lookalike spellings match: strips zero-width and direction marks,
// Arabic/Urdu diacritics and tatweel, maps Arabic letter forms to their
// Urdu equivalents, and lowercases. Without this, "O<zero-width space>TP"
// or a transcript using the Arabic yeh would slip past the patterns.
export function normalizeForMatching(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replaceAll(/ي/g, "ی")
    .replaceAll(/ك/g, "ک")
    .toLowerCase()
}

// Returns { risk, reason, scam_type } for the strongest match, or null when
// nothing in the text is a clear credential request or urgent payment demand.
export function scanHeuristics(text) {
  let best = null
  for (const sentence of normalizeForMatching(text).split(/[.!?؟۔\n]+/)) {
    if (ADVICE.test(sentence)) continue
    for (const rule of RULES) {
      if (rule.matches(sentence) && (!best || rule.risk > best.risk)) {
        best = { risk: rule.risk, reason: rule.reason, scam_type: rule.scam_type }
      }
    }
  }
  return best
}