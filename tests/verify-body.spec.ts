import { describe, expect, it } from 'vitest'
import { MAX_VERIFY_BODY_BYTES, parseVerifyRequestBody } from '../src/verify-body.ts'

const VALID = { baseUrl: 'https://relay.example/v1', model: 'gpt-4o-mini' }

describe('parseVerifyRequestBody: size cap (§3.3.2, 256KB)', () => {
  it('rejects a body over 256KB with 413', () => {
    const huge = JSON.stringify({ ...VALID, pad: 'x'.repeat(MAX_VERIFY_BODY_BYTES) })
    const result = parseVerifyRequestBody(huge)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(413)
      expect(result.error).toBe('payload_too_large')
    }
  })

  it('accepts a body at or just under the cap', () => {
    const ok = parseVerifyRequestBody(JSON.stringify(VALID))
    expect(ok.ok).toBe(true)
  })
})

describe('parseVerifyRequestBody: JSON envelope', () => {
  it('rejects malformed JSON with 400 invalid-json', () => {
    const result = parseVerifyRequestBody('{not json')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
      expect(result.error).toBe('invalid-json')
    }
  })

  it('rejects an array, scalar, or null body with 400 not-an-object', () => {
    for (const body of ['[1,2]', '42', 'null', '"str"']) {
      const result = parseVerifyRequestBody(body)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBe('not-an-object')
    }
  })
})

describe('parseVerifyRequestBody: field whitelist + types', () => {
  it('rejects an unknown field with 400 unknown_field', () => {
    const result = parseVerifyRequestBody(JSON.stringify({ ...VALID, admin: true }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
      expect(result.error).toBe('unknown_field')
    }
  })

  it('requires a non-empty string baseUrl', () => {
    for (const body of [{}, { model: 'm' }, { baseUrl: 123, model: 'm' }, { baseUrl: '  ', model: 'm' }]) {
      const result = parseVerifyRequestBody(JSON.stringify(body))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBe('missing_field')
    }
  })

  it('requires a non-empty string model', () => {
    const result = parseVerifyRequestBody(JSON.stringify({ baseUrl: VALID.baseUrl }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('missing_field')
  })

  it('rejects wrong types for optional fields', () => {
    const cases = [
      { ...VALID, apiKey: 123 },
      { ...VALID, apiKeyEnv: 42 },
      { ...VALID, allowLocal: 'yes' },
      { ...VALID, confirmCustomCommand: 1 },
    ]
    for (const body of cases) {
      const result = parseVerifyRequestBody(JSON.stringify(body))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBe('invalid_type')
    }
  })

  it('accepts a valid body, trims strings, and defaults booleans', () => {
    const result = parseVerifyRequestBody(JSON.stringify({
      baseUrl: '  https://relay.example/v1  ',
      model: '  gpt-4o-mini  ',
      apiKey: 'sk-x',
      allowLocal: true,
      confirmCustomCommand: true,
    }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.body.baseUrl).toBe('https://relay.example/v1')
      expect(result.body.model).toBe('gpt-4o-mini')
      expect(result.body.apiKey).toBe('sk-x')
      expect(result.body.allowLocal).toBe(true)
      expect(result.body.confirmCustomCommand).toBe(true)
    }
  })

  it('trims a named apiKeyEnv', () => {
    const result = parseVerifyRequestBody(JSON.stringify({ ...VALID, apiKeyEnv: '  GATEWAY_API_KEY  ' }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.body.apiKeyEnv).toBe('GATEWAY_API_KEY')
  })

  it('rejects both apiKey and apiKeyEnv with 400 conflicting_key_fields', () => {
    const result = parseVerifyRequestBody(
      JSON.stringify({ ...VALID, apiKey: 'sk-x', apiKeyEnv: 'GATEWAY_API_KEY' }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
      expect(result.error).toBe('conflicting_key_fields')
    }
  })

  it('drops empty optional strings and defaults missing booleans to false', () => {
    const result = parseVerifyRequestBody(JSON.stringify(VALID))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.body.apiKey).toBeUndefined()
      expect(result.body.apiKeyEnv).toBeUndefined()
      expect(result.body.allowLocal).toBe(false)
      expect(result.body.confirmCustomCommand).toBe(false)
    }
  })

  it('rejects a model starting with "-" (CLI flag injection)', () => {
    const result = parseVerifyRequestBody(JSON.stringify({ ...VALID, model: '--evil' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid_value')
  })

  it('rejects a baseUrl starting with "-" (CLI flag injection)', () => {
    const result = parseVerifyRequestBody(JSON.stringify({ ...VALID, baseUrl: '--evil' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid_value')
  })

  it('rejects an apiKeyEnv that is not a valid identifier', () => {
    for (const bad of ['--foo', 'A=B', 'has space', '1STARTSDIGIT']) {
      const result = parseVerifyRequestBody(JSON.stringify({ ...VALID, apiKeyEnv: bad }))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBe('invalid_value')
    }
  })
})
