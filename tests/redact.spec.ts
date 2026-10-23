import { describe, expect, it } from 'vitest'
import { redactRecord, redactText } from '../src/redact.ts'

describe('redactText', () => {
  it('masks an sk- style key while keeping a prefix and tail', () => {
    const out = redactText('used sk-abcdef1234567890 here')
    expect(out).not.toContain('abcdef1234567890')
    expect(out).toContain('sk-')
  })

  it('redacts a Bearer token', () => {
    expect(redactText('Authorization: Bearer abc.def.ghi')).toContain('Bearer <redacted>')
  })

  it('redacts api_key= and token= assignments', () => {
    expect(redactText('api_key=sk-secret123')).toContain('<redacted>')
    expect(redactText('token: abc123token')).toContain('<redacted>')
  })

  it('strips credentials embedded in a URL', () => {
    const out = redactText('https://user:password123@gateway.example/v1')
    expect(out).not.toContain('password123')
    expect(out).toContain('<redacted>:<redacted>@')
  })

  it('redacts GitHub and AWS style tokens', () => {
    expect(redactText('token ghp_abcdefgh1234567890 here')).not.toContain('abcdefgh1234567890')
    expect(redactText('id AKIAIOSFODNN7EXAMPLE')).toContain('<redacted>')
  })

  it('redacts a generic high-entropy mixed-case/digit secret', () => {
    const out = redactText('key AbCdEfGhIjKlMnOpQrSt1234567890 end')
    expect(out).not.toContain('AbCdEfGhIjKlMnOpQrSt1234567890')
    expect(out).toContain('<redacted>')
  })

  it('leaves clean text untouched and handles empty input', () => {
    expect(redactText('hello world')).toBe('hello world')
    expect(redactText(undefined)).toBe('')
    expect(redactText(null)).toBe('')
  })
})

describe('redactRecord', () => {
  it('redacts string values and passes others through', () => {
    const out = redactRecord({ msg: 'key sk-abcdef123456', n: 3, ok: true })
    expect(out.msg).not.toContain('abcdef123456')
    expect(out.n).toBe(3)
    expect(out.ok).toBe(true)
  })
})
