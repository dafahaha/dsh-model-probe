import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendEntry, hostOfUrl, makeId, readHistory } from '../src/history.ts'
import type { HistoryEntry } from '../src/types.ts'

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: makeId(),
    timestamp: '2026-10-19T00:00:00Z',
    host: 'relay.example',
    model: 'gpt-4o-mini',
    verdict: 'pass',
    confidence: 'medium',
    posterior: 0.87,
    tokenizerVerdict: 'match',
    behavioralSamples: 8,
    requestsUsed: 17,
    errorCode: null,
    ...over,
  }
}

describe('hostOfUrl', () => {
  it('returns hostname only and drops path, query and credentials', () => {
    expect(hostOfUrl('https://user:pw@relay.example/v1?x=1')).toBe('relay.example')
  })

  it('appends a non-default port', () => {
    expect(hostOfUrl('http://127.0.0.1:8765/v1')).toBe('127.0.0.1:8765')
  })

  it('rejects non-http(s) and unparseable input', () => {
    expect(hostOfUrl('ftp://files.example')).toBe('unknown-host')
    expect(hostOfUrl('not a url')).toBe('unknown-host')
  })

  it('normalizes hostname case so one host does not split into two history rows', () => {
    expect(hostOfUrl('https://Relay.Example/v1')).toBe('relay.example')
    expect(hostOfUrl('https://RELAY.EXAMPLE:8443/v1')).toBe('relay.example:8443')
  })
})

describe('append-only history', () => {
  it('appends and reads rows back in file order', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hist-'))
    const file = join(dir, 'history.jsonl')
    await appendEntry(file, entry({ verdict: 'pass' }))
    await appendEntry(file, entry({ verdict: 'suspicious' }))
    const rows = await readHistory(file)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.verdict).toBe('pass')
    expect(rows[1]?.verdict).toBe('suspicious')
  })

  it('serializes concurrent appends through the in-process chain (no torn/missing rows)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hist-'))
    const file = join(dir, 'history.jsonl')
    const N = 20
    await Promise.all(
      Array.from({ length: N }, (_, i) => appendEntry(file, entry({ id: `row-${i}`, verdict: 'pass' }))),
    )
    const rows = await readHistory(file)
    expect(rows).toHaveLength(N)
    expect(new Set(rows.map(r => r.id)).size).toBe(N)
  })

  it('skips malformed lines without failing the read', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hist-'))
    const file = join(dir, 'history.jsonl')
    const { appendFile } = await import('node:fs/promises')
    await appendFile(file, '{"id":"a","verdict":"pass"}\n{bad json}\n\n', 'utf8')
    const rows = await readHistory(file)
    expect(rows).toHaveLength(1)
  })

  it('returns empty for a missing file', async () => {
    expect(await readHistory(join(tmpdir(), 'nope.jsonl'))).toEqual([])
  })

  it('never stores a key or full URL in a row', () => {
    const row = entry()
    const serialized = JSON.stringify(row)
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/)
    expect(serialized).not.toContain('/v1')
    expect(serialized).not.toContain('?')
  })
})
