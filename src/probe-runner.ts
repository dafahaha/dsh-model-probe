/**
 * Spawn the local `transit-truth verify` CLI and capture its stdout/stderr.
 * The key already lives in the child environment (see `probe-args.ts`); this
 * module never logs argv or env, and stderr is redacted before it leaves here.
 *
 * @module dsh-model-probe/probe-runner
 */

import { spawn } from 'node:child_process'
import { redactText } from './redact.ts'

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

/** A byte ceiling on captured stdout so a runaway process cannot fill memory. */
const MAX_STDOUT_BYTES = 256 * 1024

/**
 * Run the CLI and resolve with the captured result. A timeout kills the child
 * (SIGKILL on Windows) and resolves `timedOut` rather than rejecting.
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

    let stdout = ''
    let stderr = ''
    let capped = false
    let stderrTruncated = false
    let settled = false
    let spawnErrorCode: string | null = null

    const finish = (code: number | null, timedOut: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // Redact both streams before they leave the runner: a key-shaped string
      // the CLI ever printed into stdout must not reach the parser/response.
      resolve({
        code, stdout: redactText(stdout), stderr: redactText(stderr),
        timedOut, spawnErrorCode, stdoutTruncated: capped, stderrTruncated,
      })
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(null, true)
    }, inputs.timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      if (capped) return
      const next = stdout + chunk.toString('utf8')
      if (Buffer.byteLength(next, 'utf8') > MAX_STDOUT_BYTES) {
        // Mark (rather than silently drop) so a missing report can be told
        // apart from "output exceeded the byte cap".
        capped = true
        return
      }
      stdout = next
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      const next = stderr + chunk.toString('utf8')
      if (next.length > 16 * 1024) {
        stderrTruncated = true
        stderr = next.slice(-16 * 1024)
        return
      }
      stderr = next
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
