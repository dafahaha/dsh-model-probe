import { describe, expect, it } from 'vitest'
import {
  isVerdict,
  normalizeVerifyReport,
  outcomeFromExitCode,
  parseVerifyReport,
  resolveFinalVerdict,
  summarizeEvidence,
} from '../src/report.ts'
import type { RawReport } from '../src/report.ts'

describe('parseVerifyReport', () => {
  it('parses a valid JSON object', () => {
    const raw = parseVerifyReport('{"verdict":"pass","claimed_model":"gpt-4o-mini"}')
    expect(raw.verdict).toBe('pass')
  })

  it('rejects non-JSON text', () => {
    expect(() => parseVerifyReport('not json')).toThrow(/JSON/)
  })

  it('rejects an array or scalar', () => {
    expect(() => parseVerifyReport('[1,2]')).toThrow(/object/)
    expect(() => parseVerifyReport('42')).toThrow(/object/)
  })
})

describe('isVerdict', () => {
  it('accepts the three known verdicts', () => {
    expect(isVerdict('pass')).toBe(true)
    expect(isVerdict('suspicious')).toBe(true)
    expect(isVerdict('insufficient_evidence')).toBe(true)
  })

  it('rejects unknown values', () => {
    expect(isVerdict('fail')).toBe(false)
    expect(isVerdict(undefined)).toBe(false)
  })
})

describe('summarizeEvidence', () => {
  it('reads posterior, CI, tokenizer and sample counts', () => {
    const raw: RawReport = {
      statistics: {
        posterior: 0.87,
        posterior_ci_95: [0.71, 0.95],
        matched_reference_model: 'gpt-4o-mini',
        tokenizer_consistency: { verdict: 'match', score: 1, overlap: 5, consistent: 5 },
      },
      sample_sizes: { behavioral_samples: 8, requests_used: 17, request_failures: 0 },
    }
    const s = summarizeEvidence(raw)
    expect(s.posterior).toBe(0.87)
    expect(s.posteriorCi95).toEqual([0.71, 0.95])
    expect(s.tokenizer?.verdict).toBe('match')
    expect(s.behavioralSamples).toBe(8)
    expect(s.requestsUsed).toBe(17)
  })

  it('returns nulls when statistics are absent', () => {
    const s = summarizeEvidence({})
    expect(s.posterior).toBeNull()
    expect(s.posteriorCi95).toBeNull()
    expect(s.tokenizer).toBeNull()
  })
})

describe('normalizeVerifyReport', () => {
  it('falls back to insufficient_evidence on an unknown verdict', () => {
    const n = normalizeVerifyReport({ verdict: 'maybe' })
    expect(n.verdict).toBe('insufficient_evidence')
  })

  it('keeps a known verdict and maps the error block', () => {
    const n = normalizeVerifyReport({
      verdict: 'suspicious',
      confidence: 'high',
      error: { code: 'mismatch', message: 'family differs' },
    })
    expect(n.verdict).toBe('suspicious')
    expect(n.confidence).toBe('high')
    expect(n.error?.code).toBe('mismatch')
  })

  it('defaults missing confidence to low', () => {
    expect(normalizeVerifyReport({}).confidence).toBe('low')
  })

  it('reduces endpoint_base_url to host only, dropping path/query/userinfo', () => {
    const n = normalizeVerifyReport({
      endpoint_base_url: 'https://user:pw@relay.example:8443/v1/chat?key=sk-leaked99',
    })
    expect(n.endpointHost).toBe('relay.example:8443')
    expect(n.endpointHost).not.toContain('user')
    expect(n.endpointHost).not.toContain('?')
    expect(n.endpointHost).not.toContain('/v1')
  })

  it('returns empty host for non-http(s) or unparseable endpoint', () => {
    expect(normalizeVerifyReport({ endpoint_base_url: 'ftp://files.example' }).endpointHost).toBe('')
    expect(normalizeVerifyReport({ endpoint_base_url: 'not a url' }).endpointHost).toBe('')
  })
})

describe('outcomeFromExitCode', () => {
  it('maps 3 to suspicious, 2 to error, 0 to ok', () => {
    expect(outcomeFromExitCode(3)).toBe('suspicious')
    expect(outcomeFromExitCode(2)).toBe('error')
    expect(outcomeFromExitCode(0)).toBe('ok')
  })

  it('treats unexpected codes and signals as error', () => {
    expect(outcomeFromExitCode(1)).toBe('error')
    expect(outcomeFromExitCode(null)).toBe('error')
  })
})

describe('resolveFinalVerdict', () => {
  it('exit 3 forces suspicious regardless of JSON', () => {
    const n = normalizeVerifyReport({ verdict: 'pass' })
    expect(resolveFinalVerdict(3, n)).toEqual({ verdict: 'suspicious', errorCode: null })
  })

  it('exit 2 fails closed to insufficient_evidence with an error code', () => {
    const n = normalizeVerifyReport({ error: { code: 'transport_error', message: 'x' } })
    expect(resolveFinalVerdict(2, n)).toEqual({
      verdict: 'insufficient_evidence',
      errorCode: 'transport_error',
    })
  })

  it('exit 0 trusts the JSON verdict', () => {
    const n = normalizeVerifyReport({ verdict: 'pass' })
    expect(resolveFinalVerdict(0, n).verdict).toBe('pass')
  })
})
