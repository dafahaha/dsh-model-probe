/**
 * Shared types for dsh-model-probe.
 *
 * The host surfaces this plugin touches (Cordis context, the connection
 * `/api` channel, the client slot registry) are declared loosely here so the
 * package compiles without a hard dependency on the host's runtime packages;
 * every lookup is optional and degrades on an older or smaller host.
 *
 * @module dsh-model-probe/types
 */

/** The three TransitTruth verdicts, unchanged from the kernel. */
export type Verdict = 'pass' | 'suspicious' | 'insufficient_evidence'

/** Allowed verdicts as a runtime list. */
export const VERDICTS: readonly Verdict[] = ['pass', 'suspicious', 'insufficient_evidence']

/** Tokenizer-consistency block inside `statistics`, as far as the badge reads. */
export interface TokenizerSignal {
  verdict: string
  score: number | null
  overlap: number
  consistent: number
}

/** The evidence summary the badge and history row display. */
export interface EvidenceSummary {
  posterior: number | null
  posteriorCi95: [number, number] | null
  tokenizer: TokenizerSignal | null
  matchedReferenceModel: string | null
  behavioralSamples: number
  requestsUsed: number
  requestFailures: number
}

/** A normalized, key-free probe result returned to the page and stored in history. */
export interface NormalizedReport {
  claimedModel: string
  endpointHost: string
  timestamp: string
  verdict: Verdict
  confidence: string
  evidenceReason: string
  error: { code: string; message: string } | null
  summary: EvidenceSummary
  disclaimer: string
}

/** One append-only history row. Host only; never a key or a full URL. */
export interface HistoryEntry {
  id: string
  timestamp: string
  host: string
  model: string
  verdict: Verdict
  confidence: string
  posterior: number | null
  tokenizerVerdict: string | null
  behavioralSamples: number
  requestsUsed: number
  errorCode: string | null
}

/** A best-effort prefilled endpoint read from the profile patch (host only). */
export interface PrefilledEndpoint {
  providerId: string
  baseUrl: string
  host: string
  modelId: string
  apiKeyEnv: string | null
}

/** Loose host connection channel (dsh 0.1.7+), as far as this plugin reads it. */
export interface ConnectionRoute {
  path: string
  methods: readonly ('GET' | 'HEAD' | 'POST')[]
  requestBody: 'buffered' | 'streaming'
  fetch: (request: Request) => Promise<Response>
}

export interface ConnectionFetch {
  register(route: ConnectionRoute): () => unknown
}

/** Minimal Cordis context surface this plugin uses. */
export interface LooseContext {
  get(name: string): unknown
  inject(name: string | readonly string[], handler: (scope: LooseScope) => void): void
  on(name: string, listener: (...args: unknown[]) => void): unknown
  effect(fn: () => unknown, label?: string): void
}

export interface LooseScope {
  get(name: string): unknown
  effect(fn: () => unknown, label?: string): void
}

/** Plugin deployment configuration (validated loosely; all fields optional). */
export interface ProbeConfig {
  /** Executable to invoke; defaults to `transit-truth` on PATH. */
  command: string
  /** Probe requests forwarded to `--max-requests`; config-schema enforces a ceiling of 200. */
  maxRequests: number
  /** Whole-battery wall-clock cap forwarded to `--total-timeout` (seconds); config-schema enforces a ceiling of 600. */
  totalTimeout: number
  /** Pass `--allow-local` (loopback/private targets) for self-test. */
  allowLocal: boolean
}
