import { describe, expect, it } from 'vitest'
import {
  MAX_STDOUT_BYTES,
  MAX_STDERR_CHARS,
  OutputCapture,
  TailCapture,
  runVerify,
} from '../src/probe-runner.ts'

describe('OutputCapture byte cap (stdout truncation)', () => {
  it('accumulates small chunks without truncating', () => {
    const cap = new OutputCapture()
    cap.append('{"a":1}', MAX_STDOUT_BYTES)
    cap.append('{"b":2}', MAX_STDOUT_BYTES)
    expect(cap.truncated).toBe(false)
    expect(cap.value).toBe('{"a":1}{"b":2}')
  })

  it('latches truncated when the accumulated output crosses the byte ceiling', () => {
    const cap = new OutputCapture()
    // One chunk well over the 256KB ceiling.
    const fired = cap.append('x'.repeat(MAX_STDOUT_BYTES + 1024), MAX_STDOUT_BYTES)
    expect(fired).toBe(true)
    expect(cap.truncated).toBe(true)
    // Once latched, further chunks are ignored and the flag stays true.
    expect(cap.append('more', MAX_STDOUT_BYTES)).toBe(true)
    expect(cap.truncated).toBe(true)
  })

  it('counts the ceiling in UTF-8 bytes (multi-byte chars count more)', () => {
    const cap = new OutputCapture()
    // Each "中" is 3 UTF-8 bytes; a 100k-char string is 300KB > 256KB.
    cap.append('中'.repeat(100_000), MAX_STDOUT_BYTES)
    expect(cap.truncated).toBe(true)
  })
})

describe('TailCapture (stderr tail)', () => {
  it('keeps small stderr unchanged', () => {
    const cap = new TailCapture()
    cap.append('a warning', MAX_STDERR_CHARS)
    expect(cap.truncated).toBe(false)
    expect(cap.value).toBe('a warning')
  })

  it('keeps only the trailing window once the ceiling fires', () => {
    const cap = new TailCapture()
    cap.append('y'.repeat(MAX_STDERR_CHARS + 100), MAX_STDERR_CHARS)
    expect(cap.truncated).toBe(true)
    expect(cap.value.length).toBe(MAX_STDERR_CHARS)
    // The retained tail is the newest output.
    expect(cap.value.endsWith('y')).toBe(true)
  })
})

describe('runVerify end-to-end smoke', () => {
  it('captures a small, well-formed child run', async () => {
    const result = await runVerify({
      command: process.execPath,
      args: ['-e', "process.stdout.write('ok')"],
      env: process.env,
      timeoutMs: 10_000,
    })
    expect(result.stdout).toBe('ok')
    expect(result.code).toBe(0)
    expect(result.timedOut).toBe(false)
    expect(result.stdoutTruncated).toBe(false)
    expect(result.stderrTruncated).toBe(false)
  }, 15_000)

  it('reports a spawn error code for a missing command (fail-closed)', async () => {
    const result = await runVerify({
      command: 'definitely-not-a-real-command-xyz',
      args: [],
      env: process.env,
      timeoutMs: 10_000,
    })
    expect(result.code).toBe(null)
    expect(result.spawnErrorCode).toBe('ENOENT')
  }, 15_000)
})
