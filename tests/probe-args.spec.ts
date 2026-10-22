import { describe, expect, it } from 'vitest'
import {
  buildChildEnv,
  buildVerifyArgs,
  resolveCommand,
  resolveKeyRouting,
  withApiKeyEnv,
} from '../src/probe-args.ts'

describe('buildVerifyArgs', () => {
  it('builds base-url, model, knobs and never carries a key', () => {
    const args = buildVerifyArgs({
      baseUrl: 'https://relay.example/v1',
      model: 'gpt-4o-mini',
      maxRequests: 12,
      totalTimeout: 60,
      allowLocal: false,
    })
    expect(args).toContain('--base-url')
    expect(args).toContain('https://relay.example/v1')
    expect(args).toContain('--model')
    expect(args).toContain('gpt-4o-mini')
    expect(args).toContain('--max-requests')
    expect(args).toContain('12')
    expect(args).toContain('--total-timeout')
    expect(args).toContain('60')
    expect(args.join(' ')).not.toMatch(/sk-[A-Za-z0-9]/)
  })

  it('appends --allow-local when requested', () => {
    const args = buildVerifyArgs({
      baseUrl: 'http://127.0.0.1:8765/v1',
      model: 'qwen2.5-0.5b-instruct',
      maxRequests: 5,
      totalTimeout: 20,
      allowLocal: true,
    })
    expect(args).toContain('--allow-local')
  })

  it('never emits --allow-local for false, undefined, or illegal values (only true opts in)', () => {
    const base = {
      baseUrl: 'https://relay.example/v1',
      model: 'gpt-4o-mini',
      maxRequests: 12,
      totalTimeout: 60,
    }
    // Runtime variants beyond the typed boolean, exercising the guard defensively.
    const denials = [false, undefined, null, 0, '', 'yes', NaN]
    for (const value of denials) {
      const args = buildVerifyArgs({ ...base, allowLocal: value } as never)
      expect(args, `allowLocal=${String(value)} must not add --allow-local`)
        .not.toContain('--allow-local')
    }
    const optedIn = buildVerifyArgs({ ...base, allowLocal: true })
    expect(optedIn).toContain('--allow-local')
  })
})

describe('resolveKeyRouting', () => {
  it('routes an inline key into the throwaway env var', () => {
    const r = resolveKeyRouting('sk-pasted123')
    expect(r.setKey).toBe('sk-pasted123')
    expect(r.envName).toBe('DSH_MODEL_PROBE_KEY')
    expect(r.passThroughEnv).toBeUndefined()
  })

  it('passes a named env var through without reading it', () => {
    const r = resolveKeyRouting(undefined, 'GATEWAY_API_KEY')
    expect(r.passThroughEnv).toBe('GATEWAY_API_KEY')
    expect(r.setKey).toBeUndefined()
  })

  it('returns no key when neither is supplied', () => {
    const r = resolveKeyRouting()
    expect(r.setKey).toBeUndefined()
    expect(r.passThroughEnv).toBeUndefined()
  })
})

describe('withApiKeyEnv', () => {
  it('appends --api-key-env with the routing var name', () => {
    const args = withApiKeyEnv(['verify', '--model', 'm'], resolveKeyRouting(undefined, 'MY_KEY'))
    expect(args).toEqual(['verify', '--model', 'm', '--api-key-env', 'MY_KEY'])
  })
})

describe('buildChildEnv (§3.6.4 minimal-credential whitelist)', () => {
  it('sets the throwaway key var and does not mutate the parent', () => {
    const parent = { PATH: '/usr/bin' }
    const child = buildChildEnv(parent, resolveKeyRouting('sk-x'))
    expect(child.DSH_MODEL_PROBE_KEY).toBe('sk-x')
    expect(parent.DSH_MODEL_PROBE_KEY).toBeUndefined()
  })

  it('drops marker secrets from the parent instead of inheriting them wholesale', () => {
    const parent = {
      PATH: '/usr/bin',
      AWS_SECRET_ACCESS_KEY: 'aws-secret-marker',
      DASHBOARD_TOKEN: 'dashboard-token-marker',
      OPENAI_API_KEY: 'sk-parent-leaked',
      HOME: '/home/probe',
    }
    const child = buildChildEnv(parent, resolveKeyRouting())
    expect(child.AWS_SECRET_ACCESS_KEY).toBeUndefined()
    expect(child.DASHBOARD_TOKEN).toBeUndefined()
    expect(child.OPENAI_API_KEY).toBeUndefined()
    // Launcher essentials on the whitelist still reach the child.
    expect(child.PATH).toBe('/usr/bin')
    if (process.platform !== 'win32') expect(child.HOME).toBe('/home/probe')
  })

  it('forwards the named pass-through key var by name while dropping unrelated secrets', () => {
    const parent = {
      PATH: '/usr/bin',
      GATEWAY_API_KEY: 'gateway-value',
      LEAKED_TOKEN: 'leaked-marker',
    }
    const child = buildChildEnv(parent, resolveKeyRouting(undefined, 'GATEWAY_API_KEY'))
    expect(child.GATEWAY_API_KEY).toBe('gateway-value')
    expect(child.LEAKED_TOKEN).toBeUndefined()
    expect(child.DSH_MODEL_PROBE_KEY).toBeUndefined()
  })

  it('does not copy a named pass-through var that the parent does not define', () => {
    const child = buildChildEnv({ PATH: '/usr/bin' }, resolveKeyRouting(undefined, 'MISSING_KEY'))
    expect(child.MISSING_KEY).toBeUndefined()
  })

  it('keeps platform launcher essentials when present and always drops markers', () => {
    const parent = {
      Path: 'C:\\Windows\\system32',
      SystemRoot: 'C:\\Windows',
      ComSpec: 'C:\\Windows\\System32\\cmd.exe',
      HOME: '/home/probe',
      TMPDIR: '/tmp',
      SECRET_MARKER: 'nope',
    }
    const child = buildChildEnv(parent, resolveKeyRouting())
    expect(child.SECRET_MARKER).toBeUndefined()
    if (process.platform === 'win32') {
      expect(child.Path).toBe('C:\\Windows\\system32')
      expect(child.SystemRoot).toBe('C:\\Windows')
      expect(child.ComSpec).toBe('C:\\Windows\\System32\\cmd.exe')
    } else {
      expect(child.HOME).toBe('/home/probe')
      expect(child.TMPDIR).toBe('/tmp')
    }
  })
})

describe('resolveCommand', () => {
  it('defaults to transit-truth', () => {
    expect(resolveCommand()).toBe('transit-truth')
    expect(resolveCommand('  ')).toBe('transit-truth')
  })

  it('honors an override', () => {
    expect(resolveCommand('tt-local')).toBe('tt-local')
  })
})
