/**
 * Key redaction for anything that might reach a log, an error message, or the
 * page: child-process stderr, transport errors, and any free-text field.
 *
 * The API key itself is never stored by this plugin; these patterns are
 * defense-in-depth against a key-shaped string that leaked into a message the
 * kernel or the shell already produced.
 *
 * @module dsh-model-probe/redact
 */

/** `sk-xxxx…yz` style OpenAI-style keys. */
const SK_KEY = /\b(sk-[A-Za-z0-9_\-]{6,})\b/g

/** GitHub-style tokens (ghp_/gho_/ghu_/ghs_/ghr_/github_pat_). */
const GH_TOKEN = /\b(gh[po usr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{12,})\b/g

/** AWS access-key ids (AKIA…). */
const AWS_KEY = /\b(AKIA[0-9A-Z]{12,})\b/g

/** Generic high-entropy secret: a run of >=24 chars mixing lower, upper, digit. */
const HIGH_ENTROPY = /\b(?=[A-Za-z0-9_\-]{24,})(?=[A-Za-z0-9_\-]*[a-z])(?=[A-Za-z0-9_\-]*[A-Z])(?=[A-Za-z0-9_\-]*\d)[A-Za-z0-9_\-]{24,}/g

/** `Authorization: Bearer <token>` headers. */
const BEARER = /(Bearer\s+)[A-Za-z0-9._\-]+/gi

/** `api_key=…`, `apiKey: …`, `token=…`, `secret: …` style assignments. */
const ASSIGNMENT = /((?:api[_-]?key|apikey|access[_-]?token|token|secret|password)\s*[=:]\s*)["']?[^\s"',&]+/gi

/** Credentials embedded in a URL: `https://user:pass@host`. */
const URL_CREDENTIALS = /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/@:\s]+):([^/@\s]+)@/g

/**
 * Mask the body of one OpenAI-style key, keeping a short recognizable prefix
 * and a two-character tail so a user can tell which key it was without
 * exposing it.
 * @param match - the full `sk-...` match.
 * @returns the masked form.
 */
function maskSkKey(match: string): string {
  const body = match.slice(3)
  if (body.length <= 6) return 'sk-…'
  return `sk-${body.slice(0, 4)}…${body.slice(-2)}`
}

/**
 * Redact every credential-shaped substring in *text*.
 * @param text - possibly raw log or error text.
 * @returns text safe to show or log; empty input returns empty.
 */
export function redactText(text: string | undefined | null): string {
  if (text === undefined || text === null) return ''
  return String(text)
    .replace(SK_KEY, maskSkKey)
    .replace(GH_TOKEN, '<redacted>')
    .replace(AWS_KEY, '<redacted>')
    .replace(HIGH_ENTROPY, '<redacted>')
    .replace(BEARER, '$1<redacted>')
    .replace(ASSIGNMENT, '$1<redacted>')
    .replace(URL_CREDENTIALS, '$1<redacted>:<redacted>@')
}

/**
 * Redact a whole record's string values, returning a shallow copy. Non-string
 * values pass through untouched; keys themselves are never credential names
 * this plugin stores.
 * @param record - record to redact defensively.
 * @returns a new record with string values redacted.
 */
export function redactRecord<T extends Record<string, unknown>>(record: T): T {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    out[key] = typeof value === 'string' ? redactText(value) : value
  }
  return out as T
}
