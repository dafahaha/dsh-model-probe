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
    })

    let stdout = ''
    let stderr = ''
    let capped = false
    let settled = false

    const finish = (code: number | null, timedOut: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code, stdout, stderr: redactText(stderr), timedOut })
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(null, true)
    }, inputs.timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      if (capped) return
      const next = stdout + chunk.toString('utf8')
      if (Buffer.byteLength(next, 'utf8') > MAX_STDOUT_BYTES) {
        capped = true
        return
      }
      stdout = next
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
      if (stderr.length > 16 * 1024) stderr = stderr.slice(-16 * 1024)
    })

    child.on('error', (error) => {
      // ENOENT (command not found) surfaces as an error event, not an exit code.
      finish(null, false)
      void error
    })
    child.on('close', (code) => finish(code, false))
  })
}
