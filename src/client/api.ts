/**
 * Browser-side fetch wrappers for the plugin's authenticated `/api` routes.
 * Same-origin credentials carry the browser session cookie; the routes reject
 * non-JSON and non-same-origin requests at the host channel.
 *
 * @module dsh-model-probe/client/api
 */

import type { HistoryEntry, NormalizedReport, PrefilledEndpoint } from '../types.ts'

/** GET /api/model-probe/endpoints answer. */
export interface EndpointsAnswer {
  endpoints: PrefilledEndpoint[]
  defaults: {
    command: string
    customCommand: boolean
    maxRequests: number
    totalTimeout: number
    allowLocal: boolean
  }
}

/** POST /api/model-probe/verify answer. */
export interface VerifyAnswer {
  report: NormalizedReport
  verdict: string
  errorCode: string | null
  timedOut: boolean
  installHint: string | null
}

/** GET /api/model-probe/history answer. */
export interface HistoryAnswer {
  history: HistoryEntry[]
}

/** Throw a readable error when a fetch does not return JSON 2xx. */
async function parseOrThrow<T>(response: Response): Promise<T> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error(`请求失败（HTTP ${response.status}），响应不是 JSON。`)
  }
  if (!response.ok) {
    const record = body as { message?: unknown; error?: unknown }
    const reason = typeof record.message === 'string'
      ? record.message
      : typeof record.error === 'string'
        ? record.error
        : `HTTP ${response.status}`
    throw new Error(reason)
  }
  return body as T
}

/** Load prefilled endpoints and defaults. */
export async function fetchEndpoints(): Promise<EndpointsAnswer> {
  const response = await fetch('/api/model-probe/endpoints', {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
  return parseOrThrow<EndpointsAnswer>(response)
}

/** Run one probe against the given endpoint. The key never persists here. */
export async function verifyEndpoint(body: {
  baseUrl: string
  model: string
  apiKey?: string
  apiKeyEnv?: string
  allowLocal?: boolean
  /** Explicit consent to spawn the custom executable path (§3.6.2). */
  confirmCustomCommand?: boolean
}): Promise<VerifyAnswer> {
  const response = await fetch('/api/model-probe/verify', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
  return parseOrThrow<VerifyAnswer>(response)
}

/** Load history newest-first. */
export async function fetchHistory(): Promise<HistoryEntry[]> {
  const response = await fetch('/api/model-probe/history', {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
  const answer = await parseOrThrow<HistoryAnswer>(response)
  return answer.history
}
