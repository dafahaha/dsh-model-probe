/**
 * Parse and normalize a TransitTruth `verify` JSON report into the key-free
 * shape the badge, evidence summary, and history row use. This module holds no
 * verification logic of its own: it only reads what the kernel emitted.
 *
 * @module dsh-model-probe/report
 */

import {
  VERDICTS,
  type EvidenceSummary,
  type NormalizedReport,
  type TokenizerSignal,
  type Verdict,
} from './types.ts'

/** A raw report object as emitted by `transit-truth verify` (loose shape). */
export interface RawReport {
  claimed_model?: unknown
  endpoint_base_url?: unknown
  timestamp?: unknown
  verdict?: unknown
  confidence?: unknown
  sample_sizes?: unknown
  statistics?: unknown
  evidence_reason?: unknown
  error?: unknown
  disclaimer?: unknown
}

/** Thrown when stdout is not a usable verify report. */
export class ReportParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReportParseError'
  }
}

/**
 * Parse stdout text into a raw report object.
 * @param text - stdout from the CLI (single JSON document).
 * @returns the parsed object.
 * @throws ReportParseError when text is not JSON or not a report object.
 */
export function parseVerifyReport(text: string): RawReport {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new ReportParseError(`stdout is not valid JSON: ${(cause as Error).message}`)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ReportParseError('verify stdout must be a JSON object')
  }
  return parsed as RawReport
}

/**
 * Whether *value* is one of the three public verdicts.
 * @param value - candidate value.
 * @returns true when it is a known verdict.
 */
export function isVerdict(value: unknown): value is Verdict {
  return typeof value === 'string' && (VERDICTS as readonly string[]).includes(value)
}

/** Read a string field defensively. */
function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Read a finite number field defensively. */
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Reduce an endpoint URL to host(:port) only, dropping userinfo, path, query and
 * fragment. Defense-in-depth: a kernel report must never carry a key-in-query or
 * a full path into the normalized report / history. Unparseable or non-http(s)
 * input yields '' (preserving the empty fallback), never a guess.
 */
function hostOnly(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return ''
  try {
    const u = new URL(value)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    const host = u.hostname.toLowerCase()
    if (!host) return ''
    const defaultPort = u.protocol === 'https:' ? '443' : '80'
    return u.port && u.port !== defaultPort ? `${host}:${u.port}` : host
  } catch {
    return ''
  }
}

/** Read the tokenizer-consistency block from `statistics`. */
function tokenizerOf(statistics: unknown): TokenizerSignal | null {
  if (typeof statistics !== 'object' || statistics === null) return null
  const block = (statistics as Record<string, unknown>).tokenizer_consistency
  if (typeof block !== 'object' || block === null) return null
  const b = block as Record<string, unknown>
  return {
    verdict: typeof b.verdict === 'string' ? b.verdict : 'unknown',
    score: num(b.score),
    overlap: num(b.overlap) ?? 0,
    consistent: num(b.consistent) ?? 0,
  }
}

/** Build the evidence summary from a raw report. */
export function summarizeEvidence(raw: RawReport): EvidenceSummary {
  const statistics = raw.statistics
  const stats = typeof statistics === 'object' && statistics !== null
    ? (statistics as Record<string, unknown>)
    : {}
  const sampleSizes = typeof raw.sample_sizes === 'object' && raw.sample_sizes !== null
    ? (raw.sample_sizes as Record<string, unknown>)
    : {}
  const ci = stats.posterior_ci_95
  let posteriorCi95: [number, number] | null = null
  if (Array.isArray(ci) && ci.length === 2 && num(ci[0]) !== null && num(ci[1]) !== null) {
    posteriorCi95 = [num(ci[0])!, num(ci[1])!]
  }
  return {
    posterior: num(stats.posterior),
    posteriorCi95,
    tokenizer: tokenizerOf(statistics),
    matchedReferenceModel: str(stats.matched_reference_model),
    behavioralSamples: num(sampleSizes.behavioral_samples) ?? 0,
    requestsUsed: num(sampleSizes.requests_used) ?? 0,
    requestFailures: num(sampleSizes.request_failures) ?? 0,
  }
}

/**
 * Normalize a raw report into the key-free shape the UI and history use.
 * An unknown verdict falls back to `insufficient_evidence` rather than guessing.
 * @param raw - parsed raw report.
 * @returns normalized report.
 */
export function normalizeVerifyReport(raw: RawReport): NormalizedReport {
  const verdict = isVerdict(raw.verdict) ? raw.verdict : 'insufficient_evidence'
  const errorRaw = raw.error
  const error = typeof errorRaw === 'object' && errorRaw !== null
    ? {
        code: str((errorRaw as Record<string, unknown>).code) ?? 'unknown_error',
        message: str((errorRaw as Record<string, unknown>).message) ?? '',
      }
    : null
  return {
    claimedModel: str(raw.claimed_model) ?? '',
    endpointHost: hostOnly(raw.endpoint_base_url),
    timestamp: str(raw.timestamp) ?? new Date(0).toISOString(),
    verdict,
    confidence: str(raw.confidence) ?? 'low',
    evidenceReason: str(raw.evidence_reason) ?? '',
    error,
    summary: summarizeEvidence(raw),
    disclaimer: str(raw.disclaimer) ?? '',
  }
}

/** How the CLI exit code maps to a coarse run outcome. */
export type RunOutcome = 'ok' | 'suspicious' | 'error'

/**
 * Map a process exit code to a coarse outcome.
 * @param code - exit code; null when the process was killed by a signal.
 * @returns coarse outcome.
 */
export function outcomeFromExitCode(code: number | null): RunOutcome {
  if (code === 3) return 'suspicious'
  if (code === 2) return 'error'
  if (code === 0) return 'ok'
  return 'error'
}

/**
 * Resolve the final verdict from the exit code and the normalized report.
 * Exit code 3 (suspicious) and 2 (error) are trusted over the JSON field; a
 * non-zero unexpected code is treated as an error and fails closed.
 * @param code - exit code.
 * @param report - normalized report.
 * @returns final verdict plus an optional error code.
 */
export function resolveFinalVerdict(code: number | null, report: NormalizedReport): {
  verdict: Verdict
  errorCode: string | null
} {
  const outcome = outcomeFromExitCode(code)
  if (outcome === 'suspicious') return { verdict: 'suspicious', errorCode: null }
  if (outcome === 'error') {
    return {
      verdict: 'insufficient_evidence',
      errorCode: report.error?.code ?? `exit_${code ?? 'signal'}`,
    }
  }
  return { verdict: report.verdict, errorCode: report.error?.code ?? null }
}
