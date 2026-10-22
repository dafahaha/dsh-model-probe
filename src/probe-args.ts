/**
 * Pure builders for the `transit-truth verify` invocation: argv, key routing,
 * and the child environment. The key never travels in argv (visible in the
 * process list and shell history); it is either read by the CLI from an
 * existing environment variable, or placed into a throwaway child-process env
 * variable this module names. Spawning itself lives in `probe-runner.ts`.
 *
 * @module dsh-model-probe/probe-args
 */

/** Options that build the verify argv. */
export interface VerifyArgOptions {
  baseUrl: string
  model: string
  maxRequests: number
  totalTimeout: number
  allowLocal: boolean
}

/** Key routing decision for one run. */
export interface KeyRouting {
  /** Env var name the CLI reads via `--api-key-env`. */
  envName: string
  /** Key to place into the child env under `envName`, when pasted inline. */
  setKey?: string
  /** Existing env var to pass through unchanged (never read here). */
  passThroughEnv?: string
}

/**
 * Build the `verify` argv. The key is absent here by construction.
 * @param opts - endpoint and knob options.
 * @returns argv array after `verify`.
 */
export function buildVerifyArgs(opts: VerifyArgOptions): string[] {
  const args = [
    'verify',
    '--base-url', opts.baseUrl,
    '--model', opts.model,
    '--max-requests', String(opts.maxRequests),
    '--total-timeout', String(opts.totalTimeout),
  ]
  // Only an explicit boolean true opts in; undefined, false, null, 0, '' and
  // any non-boolean (e.g. a truthy string) must never add --allow-local.
  if (opts.allowLocal === true) args.push('--allow-local')
  return args
}

/**
 * Decide how the key reaches the CLI.
 * - `apiKey` (pasted in the page): placed in a throwaway child env var named
 *   `DSH_MODEL_PROBE_KEY`; the CLI reads it via `--api-key-env`.
 * - `apiKeyEnv` (a named existing variable): passed through by name; this
 *   module never reads its value.
 * - neither: no key; the kernel returns a `missing_api_key` error report
 *   (`insufficient_evidence`) rather than probing.
 * @param apiKey - inline pasted key, if any.
 * @param apiKeyEnv - existing env var name, if any.
 * @returns key routing for the runner.
 */
export function resolveKeyRouting(apiKey?: string, apiKeyEnv?: string): KeyRouting {
  if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
    return { envName: 'DSH_MODEL_PROBE_KEY', setKey: apiKey }
  }
  if (typeof apiKeyEnv === 'string' && apiKeyEnv.trim().length > 0) {
    return { envName: apiKeyEnv.trim(), passThroughEnv: apiKeyEnv.trim() }
  }
  return { envName: 'DSH_MODEL_PROBE_KEY' }
}

/**
 * Append `--api-key-env` to argv when the key routing names a var for the CLI.
 * @param args - base argv.
 * @param routing - resolved key routing.
 * @returns argv with the env flag appended.
 */
export function withApiKeyEnv(args: string[], routing: KeyRouting): string[] {
  return [...args, '--api-key-env', routing.envName]
}

/**
 * Runtime variables forwarded to the child on POSIX/Unix platforms (DSH
 * Standard §3.6.4 minimal-credential env): just enough to launch the CLI.
 */
const UNIX_PASSTHROUGH = ['PATH', 'HOME', 'TMPDIR'] as const

/**
 * Runtime variables forwarded on Windows. Matched case-insensitively so the
 * child sees `Path`/`PATH` regardless of how the host spells it; SystemRoot /
 * SystemDrive / ComSpec are required for process startup on Windows.
 */
const WINDOWS_PASSTHROUGH = [
  'Path',
  'SystemRoot',
  'SystemDrive',
  'ComSpec',
  'PATHEXT',
  'USERPROFILE',
  'TEMP',
  'TMP',
  'LOCALAPPDATA',
  'APPDATA',
] as const

/**
 * Build the child environment on a strict whitelist instead of inheriting the
 * whole parent environment (DSH Standard §3.6.4: forward only the minimal
 * env needed for the selected backend). Secrets, cloud tokens, proxy settings,
 * and every non-essential variable are dropped; only the launcher essentials
 * and the plugin's own explicitly injected probe key variable reach the child.
 *
 * @param baseEnv - parent environment (usually `process.env`).
 * @param routing - resolved key routing (inline throwaway var or named var).
 * @returns child env object.
 */
export function buildChildEnv(
  baseEnv: NodeJS.ProcessEnv,
  routing: KeyRouting,
): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = {}
  const allowed = new Set(
    (process.platform === 'win32' ? WINDOWS_PASSTHROUGH : UNIX_PASSTHROUGH)
      .map((name) => name.toUpperCase()),
  )
  for (const [name, value] of Object.entries(baseEnv)) {
    if (value === undefined || value === null) continue
    if (allowed.has(name.toUpperCase())) child[name] = value
  }
  // The plugin's own explicitly injected probe key variable: an inline paste
  // lands in the throwaway var; a named existing var is copied by name only
  // (its value is never read by this module, just forwarded for the CLI).
  if (routing.setKey !== undefined) {
    child[routing.envName] = routing.setKey
  } else if (
    routing.passThroughEnv !== undefined
    && baseEnv[routing.passThroughEnv] !== undefined
  ) {
    child[routing.passThroughEnv] = baseEnv[routing.passThroughEnv]
  }
  return child
}

/**
 * Resolve the executable name from configuration, defaulting to `transit-truth`.
 * @param command - configured command, possibly empty.
 * @returns executable to spawn.
 */
export function resolveCommand(command?: string): string {
  const trimmed = typeof command === 'string' ? command.trim() : ''
  return trimmed.length > 0 ? trimmed : 'transit-truth'
}
