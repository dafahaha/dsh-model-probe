/**
 * Bridge integration over dev-only stubs: spawn node on a canned report
 * through the real `runVerify`, then parse, normalize and resolve the verdict
 * exactly as the `/api/model-probe/verify` route does. These tests make no
 * network call and read no key; they prove the spawn -> parse -> three-state
 * -> history bridge end to end.
 */
import { describe, expect, it } from 'vitest'
import { dirname, join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { runVerify } from '../src/probe-runner.ts'
import { normalizeVerifyReport, parseVerifyReport, resolveFinalVerdict } from '../src/report.ts'
import { appendEntry, readHistory } from '../src/history.ts'

const here = dirname(fileURLToPath(import.meta.url))
const stubDir = join(here, '..', 'stubs')

/** Run one stub through the real runner and return code + normalized report. */
async function drive(stub: string) {
  const result = await runVerify({
    command: process.execPath,
    args: [join(stubDir, stub)],
    env: {},
    timeoutMs: 5000,
  })
  const normalized = normalizeVerifyReport(parseVerifyReport(result.stdout))
  return { code: result.code, normalized }
}

describe('stub bridge: pass', () => {
  it('spawns the stub, maps exit 0 to a pass with posterior and tokenizer match', async () => {
    const { code, normalized } = await drive('tt-pass.js')
    expect(code).toBe(0)
    expect(resolveFinalVerdict(code, normalized).verdict).toBe('pass')
    expect(normalized.summary.posterior).toBeCloseTo(0.87)
    expect(normalized.summary.posteriorCi95).toEqual([0.71, 0.95])
    expect(normalized.summary.tokenizer?.verdict).toBe('match')
    expect(normalized.summary.tokenizer?.consistent).toBe(5)
  })
})

describe('stub bridge: suspicious', () => {
  it('maps exit 3 to suspicious regardless of the JSON field', async () => {
    const { code, normalized } = await drive('tt-suspicious.js')
    expect(code).toBe(3)
    expect(resolveFinalVerdict(3, normalized).verdict).toBe('suspicious')
    expect(normalized.summary.tokenizer?.verdict).toBe('mismatch')
    expect(normalized.summary.posterior).toBeCloseTo(0.12)
  })
})

describe('stub bridge: error fails closed', () => {
  it('maps exit 2 to insufficient_evidence and keeps the error code', async () => {
    const { code, normalized } = await drive('tt-error.js')
    expect(code).toBe(2)
    const resolved = resolveFinalVerdict(2, normalized)
    expect(resolved.verdict).toBe('insufficient_evidence')
    expect(resolved.errorCode).toBe('transport_error')
  })
})

describe('stub bridge: history append-only', () => {
  it('appends a row and reads it back without a key or full URL', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stub-hist-'))
    const file = join(dir, 'history.jsonl')
    await appendEntry(file, {
      id: 'abc123',
      timestamp: '2026-10-19T03:00:00Z',
      host: 'relay.example',
      model: 'gpt-4o-mini',
      verdict: 'pass',
      confidence: 'high',
      posterior: 0.87,
      tokenizerVerdict: 'match',
      behavioralSamples: 8,
      requestsUsed: 17,
      errorCode: null,
    })
    const rows = await readHistory(file)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.verdict).toBe('pass')
    expect(JSON.stringify(rows)).not.toMatch(/sk-[A-Za-z0-9]/)
    expect(JSON.stringify(rows)).not.toContain('/v1')
  })
})
