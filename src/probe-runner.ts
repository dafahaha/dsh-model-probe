/**
 * Spawn the local `transit-truth verify` CLI and capture its stdout/stderr.
 * The key already lives in the child environment (see `probe-args.ts`); this
 * module never logs argv or env, and stderr is redacted before it leaves here.
 *
 * @module dsh-model-probe/probe-runner
 */

import { spawn } from 'node:child_process'
import { redactText } from './redact.ts'

/** A byte ceiling on captured stdout so a runaway process cannot fill memory. */
export const MAX_STDOUT_BYTES = 256 * 1024

/** A character ceiling on captured stderr (only the tail is retained). */
export const MAX_STDERR_CHARS = 16 * 1024

/**
 * A capped text accumulator. It appends until the byte ceiling fires, then
 * latches `truncated` and ignores further input (the caller destroys the read
 * side so the child is not blocked). Extracted as a pure helper so the cap
 * behavior is unit-testable without spawning a large-output child.
 */
export class OutputCapture {
  /** Accumulated text (up to the ceiling). */
  value = ''
  /** Latched once the ceiling fired; evidence beyond it was dropped. */
  truncated = false

  /**
   * Append one decoded chunk.
   * @param chunk - decoded text from the child stream.
   * @param maxBytes - byte ceiling (UTF-8).
   * @returns true when the cap fired on this append.
   */
  append(chunk: string, maxBytes: number): boolean {
    if (this.truncated) return true
    const next = this.value + chunk
    if (Buffer.byteLength(next, 'utf8') > maxBytes) {
      this.truncated = true
      return true
    }
    this.value = next
    return false
  }
}

/**
 * A tail-only stderr accumulator: once the character ceiling fires it keeps
 * only the trailing window (the newest diagnostics) and latches `truncated`.
 */
export class TailCapture {
  value = ''
  truncated = false

  append(chunk: string, maxChars: number): boolean {
    const next = this.value + chunk
    if (next.length > maxChars) {
      this.truncated = true
      this.value = next.slice(-maxChars)
      return true
    }
    this.value = next
    return false
  }
}

/** Captured run result. */
export interface RunResult {
  /** Exit code; null when killed by a signal. */
  code: number | null
  /** Raw stdout (single JSON document). */
  stdout: string
  /** Redacted stderr. */
  stderr: string
  /** True when the wall-clock cap fired before exit. */
  timedOut: boolean
  /** Node error code from a spawn failure (e.g. ENOENT/EACCES); null otherwise. */
  spawnErrorCode: string | null
  /** True when stdout was capped at the byte ceiling (evidence may be cut). */
  stdoutTruncated: boolean
  /** True when stderr exceeded the 16KB tail buffer. */
  stderrTruncated: boolean
}

/** Spawn inputs shared by the runner. */
export interface RunInputs {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
  /** Wall-clock cap in milliseconds. */
  timeoutMs: number
}

/**
 * Run the CLI and resolve with the captured result. A timeout kills the child
 * (SIGKILL) and resolves `timedOut` rather than rejecting.
 * @param inputs - command, argv, env, and cap.
 * @returns captured result.
 */
export function runVerify(inputs: RunInputs): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(inputs.command, inputs.args, {
      env: inputs.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      // Explicit: never run through a shell, so argv cannot be reinterpreted.
      shell: false,
    })

    const stdoutCap = new OutputCapture()
    const stderrCap = new TailCapture()
    let settled = false
    let spawnErrorCode: string | null = null

    const finish = (code: number | null, timedOut: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // Redact both streams before they leave the runner: a key-shaped string
      // the CLI ever printed into stdout must not reach the parser/response.
      resolve({
        code, stdout: redactText(stdoutCap.value), stderr: redactText(stderrCap.value),
        timedOut, spawnErrorCode,
        stdoutTruncated: stdoutCap.truncated,
        stderrTruncated: stderrCap.truncated,
      })
    }

    const timer = setTimeout(() => {
      // Close/timer race: if the child already exited (exitCode set) but the
      // close event is still queued, do not mark it as timed out.
      if (child.exitCode !== null || child.signalCode !== null) {
        finish(child.exitCode, false)
        return
      }
      child.kill('SIGKILL')
      finish(null, true)
    }, inputs.timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdoutCap.append(chunk.toString('utf8'), MAX_STDOUT_BYTES)) {
        // The cap fired (or was already latched). Destroy the read side so the
        // child's pending write fails fast (EPIPE) and the child exits; a
        // truncated run is fail-closed, never PASS.
        child.stdout?.destroy()
      }
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrCap.append(chunk.toString('utf8'), MAX_STDERR_CHARS)
    })

    child.on('error', (error: NodeJS.ErrnoException) => {
      // ENOENT (command not found) / EACCES surface as an error event. Keep the
      // code for diagnostics (never the full argv/env); still fail closed.
      spawnErrorCode = typeof error.code === 'string' ? error.code : 'spawn_failed'
      finish(null, false)
    })
    child.on('close', (code) => finish(code, false))
  })
}
