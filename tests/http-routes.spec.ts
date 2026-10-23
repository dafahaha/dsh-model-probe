import { describe, expect, it } from 'vitest'
import { isNonPublicHost } from '../src/http-routes.ts'

describe('isNonPublicHost (plugin-layer SSRF guard)', () => {
  it('flags loopback, private, and link-local IPv4', () => {
    const blocked = [
      '127.0.0.1',
      '127.99.0.1',
      '10.0.0.5',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.1.1',
      '0.0.0.0',
      '100.64.0.1',
    ]
    for (const h of blocked) expect(isNonPublicHost(h)).toBe(true)
  })

  it('does not flag public IPv4', () => {
    const publicHosts = ['8.8.8.8', '1.1.1.1', '172.32.0.1', '172.15.0.1', '100.63.0.1', '169.253.0.1']
    for (const h of publicHosts) expect(isNonPublicHost(h)).toBe(false)
  })

  it('flags IPv6 loopback, unique-local, and link-local', () => {
    for (const h of ['::1', '::', 'fc00::1', 'fd00::1', 'fe80::1', '0:0:0:0:0:0:0:1']) {
      expect(isNonPublicHost(h)).toBe(true)
    }
  })

  it('inspects IPv4-mapped IPv6', () => {
    expect(isNonPublicHost('::ffff:192.168.1.1')).toBe(true)
    expect(isNonPublicHost('::ffff:8.8.8.8')).toBe(false)
  })
})
