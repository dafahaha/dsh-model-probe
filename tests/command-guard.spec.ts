import { describe, expect, it } from 'vitest'
import { CustomCommandGate, isDefaultCommand } from '../src/command-guard.ts'

describe('isDefaultCommand', () => {
  it('treats empty, whitespace, and transit-truth as the default', () => {
    expect(isDefaultCommand(undefined)).toBe(true)
    expect(isDefaultCommand('')).toBe(true)
    expect(isDefaultCommand('   ')).toBe(true)
    expect(isDefaultCommand('transit-truth')).toBe(true)
  })

  it('treats any other path as custom', () => {
    expect(isDefaultCommand('/opt/tt/bin/transit-truth')).toBe(false)
    expect(isDefaultCommand('tt-local')).toBe(false)
  })
})

describe('CustomCommandGate (§3.6.2 code-execution surface)', () => {
  it('always passes the default command without confirmation', () => {
    const gate = new CustomCommandGate()
    expect(gate.check('transit-truth', false)).toEqual({ ok: true, custom: false })
    expect(gate.check('', false)).toEqual({ ok: true, custom: false })
  })

  it('blocks a custom command until explicit approval', () => {
    const gate = new CustomCommandGate()
    const blocked = gate.check('/opt/tt/bin/tt', false)
    expect(blocked.ok).toBe(false)
    expect(blocked.custom).toBe(true)
  })

  it('passes a custom command when approved and remembers the decision in-process', () => {
    const gate = new CustomCommandGate()
    expect(gate.check('/opt/tt/bin/tt', true).ok).toBe(true)
    // Granted once: later requests need no repeated approval for the same path.
    expect(gate.check('/opt/tt/bin/tt', false).ok).toBe(true)
  })

  it('keeps a different custom path blocked after granting another', () => {
    const gate = new CustomCommandGate()
    gate.check('/opt/tt/bin/tt-a', true)
    const other = gate.check('/opt/tt/bin/tt-b', false)
    expect(other.ok).toBe(false)
    expect(other.custom).toBe(true)
  })

  it('matches the exact command string (whitespace-trimmed, no prefix matching)', () => {
    const gate = new CustomCommandGate()
    gate.check('/opt/tt/bin/tt', true)
    expect(gate.check('/opt/tt/bin/tt ', false).ok).toBe(true)
    expect(gate.check('/opt/tt/bin/tt-evil', false).ok).toBe(false)
  })
})
