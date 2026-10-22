/**
 * Custom-command confirmation gate (DSH Standard §3.6.2).
 *
 * A user-configurable executable path is a **code-execution surface**: spawning
 * it runs arbitrary program bytes with the plugin process's privileges. The
 * default `transit-truth` (resolved on PATH, shipped by the documented kernel
 * install) needs no extra consent; any custom path supplied through deployment
 * configuration must carry an explicit, one-time confirmation before the first
 * spawn. A granted decision is remembered in-process per exact command string
 * for the lifetime of the plugin instance; it is never persisted to disk.
 *
 * @module dsh-model-probe/command-guard
 */

/** The in-package default executable resolved on PATH. */
export const DEFAULT_COMMAND = 'transit-truth'

/**
 * Whether *command* is the in-package default (empty or `transit-truth` after
 * trimming), which needs no execution-surface confirmation.
 * @param command - configured command from deployment config.
 * @returns true when the default executable applies.
 */
export function isDefaultCommand(command: string | undefined): boolean {
  const trimmed = typeof command === 'string' ? command.trim() : ''
  return trimmed === '' || trimmed === DEFAULT_COMMAND
}

/** Outcome of one gate check. */
export interface GateDecision {
  /** True when spawning may proceed; false when confirmation is required. */
  ok: boolean
  /** True when the resolved command is a custom (non-default) path. */
  custom: boolean
}

/**
 * In-process confirmation gate for custom executable paths. State lives for
 * the plugin instance lifetime only; restarting the host re-asks once.
 */
export class CustomCommandGate {
  /** Exact command strings already confirmed this process lifetime. */
  private readonly granted = new Set<string>()

  /**
   * Check whether *command* may be spawned now.
   * @param command - resolved executable (see `resolveCommand`).
   * @param approved - caller-supplied explicit confirmation for this request.
   * @returns decision: default commands always pass; a custom command passes
   *   only when approved now or already granted for that exact string.
   */
  check(command: string, approved: boolean): GateDecision {
    const resolved = command.trim()
    if (resolved === '' || resolved === DEFAULT_COMMAND) {
      return { ok: true, custom: false }
    }
    if (approved === true || this.granted.has(resolved)) {
      this.granted.add(resolved)
      return { ok: true, custom: true }
    }
    return { ok: false, custom: true }
  }
}
