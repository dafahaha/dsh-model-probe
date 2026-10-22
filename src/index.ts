/**
 * dsh-model-probe, node half: registers the authenticated `/api` routes that
 * run the local TransitTruth CLI, serve the prefilled endpoints, and read the
 * append-only history. The browser half (`src/client/`) renders the settings
 * section: badge, evidence summary, history list, and the fixed honesty note.
 *
 * This plugin is a thin bridge: it implements no verification logic itself.
 * The API key is read from an existing environment variable or held only in a
 * throwaway child-process env var; it is never written to disk, logged, or
 * echoed in a report.
 *
 * @module dsh-model-probe
 */

import { join } from 'node:path'
import { homedir } from 'node:os'
import { registerProbeRoutes } from './http-routes.ts'
import { validateConfig } from './config-schema.ts'
import { CustomCommandGate } from './command-guard.ts'
import type { LooseContext } from './types.ts'

/** Cordis plugin name. */
export const name = 'dsh-model-probe'
/** No required services: every host service this page touches is optional. */
export const inject: string[] = []

/** Deployment configuration; every field optional (validated by `validateConfig`). */
export interface Config {
  /** Executable on PATH; defaults to `transit-truth`. */
  command?: string
  /** Forwarded to `--max-requests` (default 20). */
  maxRequests?: number
  /** Forwarded to `--total-timeout` seconds (default 90). */
  totalTimeout?: number
  /** Pass `--allow-local` for loopback self-test (default false). */
  allowLocal?: boolean
}

/**
 * Resolve the harness-home joiner when the host provides `dshHomePath`
 * (dsh 0.1.1+); undefined on a host without it.
 * @param ctx - registrant context.
 * @returns the joiner, or undefined.
 */
function homePathJoiner(ctx: LooseContext): ((...segments: string[]) => string) | undefined {
  let value: unknown
  try {
    value = ctx.get('dshHomePath')
  } catch {
    return undefined
  }
  return typeof value === 'function' ? (value as (...segments: string[]) => string) : undefined
}

/**
 * Best-effort path of the web profile patch, used only to prefill the form.
 * @returns absolute path (may not exist yet).
 */
function resolveProfilePatchPath(): string {
  const envHome = process.env.DSH_HOME
  const base = envHome && envHome.length > 0 ? envHome : join(homedir(), '.dsh')
  return join(base, 'profiles', 'web', 'cordis.patch.yml')
}

/**
 * Tell the host's settings service that this plugin ships its own settings page,
 * so a client that generates forms from a schema does not add a second one.
 * Optional and fully degraded: the service and its `configure` method are both
 * looked up loosely and skipped when absent.
 * @param ctx - registrant context.
 */
function declineGeneratedSettingsPage(ctx: LooseContext): void {
  ctx.inject(['settings'], (scope) => {
    const settings = scope.get('settings') as
      | { configure?: (policy: { auto: boolean }, owner: unknown) => () => void }
      | undefined
    if (typeof settings?.configure !== 'function') return
    const configure = settings.configure.bind(settings)
    scope.effect(
      () => configure({ auto: false }, (ctx as LooseContext & { fiber?: unknown }).fiber),
      'dsh-model-probe: settings page policy',
    )
  })
}

/**
 * Plugin entry: validate configuration, register the routes, and decline an
 * auto-generated settings page.
 * @param ctx - registrant context.
 * @param config - raw deployment configuration (validated portably).
 */
export function apply(ctx: LooseContext, config?: Config): void {
  const { config: resolved } = validateConfig(config)
  // One in-process gate per plugin instance: custom executable-path consent
  // is remembered for the host lifetime but never persisted to disk (§3.6.2).
  const commandGate = new CustomCommandGate()
  registerProbeRoutes(ctx, {
    homePath: homePathJoiner(ctx),
    profilePatchPath: resolveProfilePatchPath,
    config: resolved,
    commandGate,
  })
  declineGeneratedSettingsPage(ctx)
}

export type {
  Verdict,
  NormalizedReport,
  EvidenceSummary,
  HistoryEntry,
  PrefilledEndpoint,
} from './types.ts'
