/**
 * Strict request-body parsing for the POST `/api/model-probe/verify` route
 * (DSH Standard §3.3.2: write routes carry a body-size cap, JSON shape
 * validation, and a parameter whitelist). This module is pure: it never
 * touches the network or the filesystem, so every rejection branch is unit
 * testable without a host.
 *
 * @module dsh-model-probe/verify-body
 */

/** Hard ceiling on the POST body: 256KB (§3.3.2 range 256KB–1MB, lower bound). */
export const MAX_VERIFY_BODY_BYTES = 256 * 1024

/** Strictly validated request fields reaching the verify handler. */
export interface VerifiedVerifyBody {
  baseUrl: string
  model: string
  apiKey?: string
  apiKeyEnv?: string
  allowLocal: boolean
  /** Explicit consent to spawn a custom (non-default) executable path. */
  confirmCustomCommand: boolean
}

/** Rejection result: HTTP status plus a fixed code/message (no internal leak). */
export type VerifyBodyRejection = {
  ok: false
  status: 400 | 413
  error: string
  message: string
}

/** Accepted result. */
export type VerifyBodyAcceptance = { ok: true; body: VerifiedVerifyBody }

/** Parse result union. */
export type VerifyBodyResult = VerifyBodyAcceptance | VerifyBodyRejection

/** The only fields this route accepts; anything else is rejected as unknown. */
const ALLOWED_FIELDS = [
  'baseUrl',
  'model',
  'apiKey',
  'apiKeyEnv',
  'allowLocal',
  'confirmCustomCommand',
] as const

/** Build a rejection without throwing. */
function reject(status: 400 | 413, error: string, message: string): VerifyBodyRejection {
  return { ok: false, status, error, message }
}

/**
 * Validate the raw POST text: byte ceiling first (covers a lied-about
 * Content-Length or a chunked stream that exceeds the cap), then JSON object,
 * field whitelist, and per-field types.
 *
 * @param rawText - raw request body text as received.
 * @returns accepted strict body, or a 400/413 rejection with a fixed message.
 */
export function parseVerifyRequestBody(rawText: string): VerifyBodyResult {
  if (Buffer.byteLength(rawText, 'utf8') > MAX_VERIFY_BODY_BYTES) {
    return reject(413, 'payload_too_large', 'request body exceeds the 256KB limit')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return reject(400, 'invalid-json', 'request body must be valid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return reject(400, 'not-an-object', 'request body must be a JSON object')
  }

  const record = parsed as Record<string, unknown>
  const unknownField = Object.keys(record).find((key) => !ALLOWED_FIELDS.includes(key as (typeof ALLOWED_FIELDS)[number]))
  if (unknownField !== undefined) {
    return reject(400, 'unknown_field', `unexpected field: ${unknownField}`)
  }

  if (typeof record.baseUrl !== 'string' || record.baseUrl.trim().length === 0) {
    return reject(400, 'missing_field', 'baseUrl is required and must be a non-empty string')
  }
  if (typeof record.model !== 'string' || record.model.trim().length === 0) {
    return reject(400, 'missing_field', 'model is required and must be a non-empty string')
  }
  if (record.apiKey !== undefined && typeof record.apiKey !== 'string') {
    return reject(400, 'invalid_type', 'apiKey must be a string')
  }
  if (record.apiKeyEnv !== undefined && typeof record.apiKeyEnv !== 'string') {
    return reject(400, 'invalid_type', 'apiKeyEnv must be a string')
  }
  if (record.allowLocal !== undefined && typeof record.allowLocal !== 'boolean') {
    return reject(400, 'invalid_type', 'allowLocal must be a boolean')
  }
  if (record.confirmCustomCommand !== undefined && typeof record.confirmCustomCommand !== 'boolean') {
    return reject(400, 'invalid_type', 'confirmCustomCommand must be a boolean')
  }

  return {
    ok: true,
    body: {
      baseUrl: record.baseUrl.trim(),
      model: record.model.trim(),
      apiKey: typeof record.apiKey === 'string' && record.apiKey.length > 0 ? record.apiKey : undefined,
      apiKeyEnv: typeof record.apiKeyEnv === 'string' && record.apiKeyEnv.trim().length > 0
        ? record.apiKeyEnv.trim()
        : undefined,
      allowLocal: record.allowLocal === true,
      confirmCustomCommand: record.confirmCustomCommand === true,
    },
  }
}
