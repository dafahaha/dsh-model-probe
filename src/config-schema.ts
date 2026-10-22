/**
 * Portable deployment-configuration schema and validation.
 *
 * The reference plugin (`dsh-visualize`) declares its runtime Config with a
 * schemastery `z.object({...})` instance that the host Loader validates. That
 * instance is a host-provided package this plugin does not bundle; to stay
 * dependency-free and load safely on hosts that do not provide it, this module
 * implements the same contract portably: each field carries a type, a default,
 * and a validator, and `validateConfig` normalizes unknown/illegal input to
 * safe defaults while recording every rejected field.
 *
 * @module dsh-model-probe/config-schema
 */

import type { ProbeConfig } from './types.ts'

/** Result of validating raw deployment configuration. */
export interface ConfigValidation {
  /** Normalized, safe configuration. */
  config: ProbeConfig
  /** Human-readable warnings for every rejected field (empty when clean). */
  errors: string[]
}

/** Safe defaults when a field is absent or illegal. */
export const CONFIG_DEFAULTS = {
  command: 'transit-truth',
  maxRequests: 20,
  totalTimeout: 90,
  allowLocal: false,
} as const

/**
 * Enforced ceilings: oversized values fall back to the default and are recorded
 * in `errors` instead of being forwarded to the kernel CLI.
 */
export const MAX_MAX_REQUESTS = 200
export const MAX_TOTAL_TIMEOUT = 600

/**
 * Validate and normalize raw deployment configuration.
 *
 * Absent fields fall back to defaults; illegal values fall back to defaults and
 * are recorded in `errors` rather than throwing, so a single bad value never
 * prevents the plugin from loading.
 *
 * @param input - raw configuration from the profile patch (possibly undefined).
 * @returns normalized config plus any rejected-field warnings.
 */
export function validateConfig(input: unknown): ConfigValidation {
  const errors: string[] = []
  const record = input !== null && typeof input === 'object'
    ? (input as Record<string, unknown>)
    : {}

  let command: string = CONFIG_DEFAULTS.command
  if (Object.prototype.hasOwnProperty.call(record, 'command')) {
    const value = record.command
    if (typeof value === 'string' && value.trim().length > 0) {
      command = value.trim()
    } else {
      errors.push('command must be a non-empty string; using default')
    }
  }

  let maxRequests: number = CONFIG_DEFAULTS.maxRequests
  if (Object.prototype.hasOwnProperty.call(record, 'maxRequests')) {
    const value = record.maxRequests
    if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_MAX_REQUESTS) {
      maxRequests = Math.floor(value)
    } else {
      errors.push(`maxRequests must be a positive finite number <= ${MAX_MAX_REQUESTS}; using default`)
    }
  }

  let totalTimeout: number = CONFIG_DEFAULTS.totalTimeout
  if (Object.prototype.hasOwnProperty.call(record, 'totalTimeout')) {
    const value = record.totalTimeout
    if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_TOTAL_TIMEOUT) {
      totalTimeout = Math.floor(value)
    } else {
      errors.push(`totalTimeout must be a positive finite number <= ${MAX_TOTAL_TIMEOUT}; using default`)
    }
  }

  let allowLocal: boolean = CONFIG_DEFAULTS.allowLocal
  if (Object.prototype.hasOwnProperty.call(record, 'allowLocal')) {
    const value = record.allowLocal
    if (typeof value === 'boolean') {
      allowLocal = value
    } else {
      errors.push('allowLocal must be a boolean; using default false')
    }
  }

  return {
    config: { command, maxRequests, totalTimeout, allowLocal },
    errors,
  }
}
