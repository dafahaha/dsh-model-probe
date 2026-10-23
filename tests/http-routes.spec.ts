import { describe, expect, it } from 'vitest'
import { isNonPublicHost, registerProbeRoutes } from '../src/http-routes.ts'
import { CustomCommandGate } from '../src/command-guard.ts'
import type { ConnectionRoute } from '../src/types.ts'

/** Build a mock host channel that captures every registered route. */
function mockHost() {
  const routes: ConnectionRoute[] = []
  const connection = {
    fetch: { register: (route: ConnectionRoute) => { routes.push(route); return () => {} } },
  }
  const ctx = {
    inject: (_deps: unknown, cb: (scope: unknown) => unknown) => {
      const scope = {
        get: (name: string) => (name === 'connection' ? connection : undefined),
        effect: (fn: () => unknown) => fn(),
      }
      cb(scope)
    },
  }
  return { ctx, routes }
}

function deps() {
  return {
    homePath: undefined,
    profilePatchPath: undefined,
    config: { command: 'transit-truth', maxRequests: 10, totalTimeout: 10, allowLocal: false },
    commandGate: new CustomCommandGate(),
  }
}

/** Find the registered route for a given path and method. */
function routeFor(routes: ConnectionRoute[], path: string, method: string) {
  const r = routes.find((x) => x.path === path && x.methods.includes(method))
  if (!r) throw new Error(`route not found: ${method} ${path}`)
  return r
}

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

  it('does not mistake a DNS name beginning like an IPv6 hextet for a non-public host', () => {
    for (const h of ['fc00.example.com', 'fd01.foo.com', 'fe80.bar.com', 'febf.qux.net']) {
      expect(isNonPublicHost(h)).toBe(false)
    }
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

  it('flags localhost by name and the whole fe80::/10 link-local range', () => {
    expect(isNonPublicHost('localhost')).toBe(true)
    expect(isNonPublicHost('LocalHost')).toBe(true)
    for (const h of ['fe80::1', 'fe90::1', 'fea0::1', 'febf::1']) {
      expect(isNonPublicHost(h)).toBe(true)
    }
    // fec0:: is outside fe80::/10 (and outside fc00::/7) -> not flagged here.
    expect(isNonPublicHost('fec0::1')).toBe(false)
  })

  it('decodes the hex form of IPv4-mapped IPv6 and tolerates brackets', () => {
    expect(isNonPublicHost('::ffff:7f00:1')).toBe(true)
    expect(isNonPublicHost('[::ffff:c0a8:0101]')).toBe(true)
    expect(isNonPublicHost('::ffff:0808:0808')).toBe(false)
  })

  it('flags trailing-dot and .localhost suffix names', () => {
    expect(isNonPublicHost('localhost.')).toBe(true)
    expect(isNonPublicHost('LocalHost.')).toBe(true)
    expect(isNonPublicHost('api.localhost')).toBe(true)
  })

  it('flags deprecated IPv4-compatible IPv6, empty host, and multiple dots', () => {
    expect(isNonPublicHost('::127.0.0.1')).toBe(true)
    expect(isNonPublicHost('::7f00:1')).toBe(true)
    expect(isNonPublicHost('::0a01:0101')).toBe(true)
    expect(isNonPublicHost('')).toBe(true)
    expect(isNonPublicHost('localhost..')).toBe(true)
  })
})

describe('POST /api/model-probe/verify input gates', () => {
  async function postVerify(baseUrl: string) {
    const host = mockHost()
    registerProbeRoutes(host.ctx as never, deps() as never)
    const route = routeFor(host.routes, '/api/model-probe/verify', 'POST')
    const request = new Request('http://localhost/api/model-probe/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseUrl, model: 'gpt-4o-mini' }),
    })
    return route.fetch(request)
  }

  it('rejects a baseUrl with embedded userinfo (400) before spawning', async () => {
    const res = await postVerify('http://user:secretpass@example.com/v1')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('url_userinfo_blocked')
  })

  it('rejects localhost when allowLocal is false (400)', async () => {
    const res = await postVerify('http://localhost:8080/v1')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('local_address_blocked')
  })

  it('rejects an apiKeyEnv that is not set in the environment (400)', async () => {
    const host = mockHost()
    registerProbeRoutes(host.ctx as never, deps() as never)
    const route = routeFor(host.routes, '/api/model-probe/verify', 'POST')
    const request = new Request('http://localhost/api/model-probe/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        baseUrl: 'http://example.com/v1',
        model: 'gpt-4o-mini',
        apiKeyEnv: 'DSH_PROBE_VAR_DEFINITELY_UNSET_12345',
      }),
    })
    const res = await route.fetch(request)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('api_key_env_unset')
  })
})
