import { describe, expect, it } from 'vitest'
import { CONFIG_DEFAULTS, MAX_MAX_REQUESTS, MAX_TOTAL_TIMEOUT, validateConfig } from '../src/config-schema.ts'

describe('validateConfig: defaults on absent fields', () => {
  it('returns safe defaults for undefined/null/non-object input', () => {
    expect(validateConfig(undefined).config).toEqual({
      command: CONFIG_DEFAULTS.command,
      maxRequests: CONFIG_DEFAULTS.maxRequests,
      totalTimeout: CONFIG_DEFAULTS.totalTimeout,
      allowLocal: CONFIG_DEFAULTS.allowLocal,
    })
    expect(validateConfig(null).config.maxRequests).toBe(CONFIG_DEFAULTS.maxRequests)
    expect(validateConfig(42).config.allowLocal).toBe(false)
  })

  it('leaves clean valid values untouched', () => {
    const { config, errors } = validateConfig({
      command: 'tt-local',
      maxRequests: 12,
      totalTimeout: 60,
      allowLocal: true,
    })
    expect(config).toEqual({ command: 'tt-local', maxRequests: 12, totalTimeout: 60, allowLocal: true })
    expect(errors).toEqual([])
  })
})

describe('validateConfig: illegal values fall back and record errors', () => {
  it('rejects a non-string/empty command and keeps the default', () => {
    const { config, errors } = validateConfig({ command: 123 })
    expect(config.command).toBe(CONFIG_DEFAULTS.command)
    expect(errors.some(e => e.includes('command'))).toBe(true)
    const empty = validateConfig({ command: '   ' })
    expect(empty.config.command).toBe(CONFIG_DEFAULTS.command)
  })

  it('rejects non-positive/non-finite maxRequests', () => {
    const { config, errors } = validateConfig({ maxRequests: -5 })
    expect(config.maxRequests).toBe(CONFIG_DEFAULTS.maxRequests)
    expect(errors.some(e => e.includes('maxRequests'))).toBe(true)
    const nan = validateConfig({ maxRequests: NaN })
    expect(nan.config.maxRequests).toBe(CONFIG_DEFAULTS.maxRequests)
  })

  it('rejects non-positive/non-finite totalTimeout', () => {
    const { config, errors } = validateConfig({ totalTimeout: 0 })
    expect(config.totalTimeout).toBe(CONFIG_DEFAULTS.totalTimeout)
    expect(errors.some(e => e.includes('totalTimeout'))).toBe(true)
  })

  it('rejects maxRequests above the enforced ceiling and keeps the default', () => {
    const { config, errors } = validateConfig({ maxRequests: MAX_MAX_REQUESTS + 1 })
    expect(config.maxRequests).toBe(CONFIG_DEFAULTS.maxRequests)
    expect(errors.some(e => e.includes('maxRequests'))).toBe(true)
  })

  it('accepts maxRequests exactly at the ceiling', () => {
    const { config, errors } = validateConfig({ maxRequests: MAX_MAX_REQUESTS })
    expect(config.maxRequests).toBe(MAX_MAX_REQUESTS)
    expect(errors).toEqual([])
  })

  it('rejects totalTimeout above the enforced ceiling and keeps the default', () => {
    const { config, errors } = validateConfig({ totalTimeout: MAX_TOTAL_TIMEOUT + 1 })
    expect(config.totalTimeout).toBe(CONFIG_DEFAULTS.totalTimeout)
    expect(errors.some(e => e.includes('totalTimeout'))).toBe(true)
  })

  it('accepts totalTimeout exactly at the ceiling', () => {
    const { config, errors } = validateConfig({ totalTimeout: MAX_TOTAL_TIMEOUT })
    expect(config.totalTimeout).toBe(MAX_TOTAL_TIMEOUT)
    expect(errors).toEqual([])
  })

  it('rejects non-boolean allowLocal and defaults to false', () => {
    const { config, errors } = validateConfig({ allowLocal: 'yes' })
    expect(config.allowLocal).toBe(false)
    expect(errors.some(e => e.includes('allowLocal'))).toBe(true)
  })

  it('ignores unknown fields without error', () => {
    const { config, errors } = validateConfig({ unknown: 'x', maxRequests: 8 })
    expect(config.maxRequests).toBe(8)
    expect(errors).toEqual([])
  })
})
