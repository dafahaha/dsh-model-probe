/**
 * The plugin's exact routes on the host's authenticated `/api` channel
 * (`ctx.connection.fetch`, dsh 0.1.7+): GET prefilled endpoints, POST run a
 * probe, GET append-only history. The host applies Host/Origin checks and
 * browser authentication before a request reaches these handlers; this module
 * additionally caps the POST body at 256KB (§3.3.2), validates a strict JSON
 * shape with a field whitelist, and gates a custom executable path behind an
 * explicit one-time confirmation (§3.6.2).
 *
 * NOTE (honest disclosure): real dsh-tui 0.16.x host live testing has NOT been
 * done; loopback + Host + Origin/Sec-Fetch-Site enforcement is the host
 * channel's responsibility, not this module's.
 *
 * @module dsh-model-probe/http-routes
 */

import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseProfileProviders } from './endpoints.ts'
import { appendEntry, hostOfUrl, makeId, readHistory } from './history.ts'
import {
  buildChildEnv,
  buildVerifyArgs,
  resolveCommand,
  resolveKeyRouting,
  withApiKeyEnv,
} from './probe-args.ts'
import { normalizeVerifyReport, parseVerifyReport, resolveFinalVerdict } from './report.ts'
import { runVerify } from './probe-runner.ts'
import { CustomCommandGate, isDefaultCommand } from './command-guard.ts'
import { parseVerifyRequestBody, type VerifiedVerifyBody } from './verify-body.ts'
import type { ConnectionRoute, LooseContext, ProbeConfig } from './types.ts'

/** Where plugin-owned state lives under the harness home. */
const STATE_DIR = 'model-probe'
const HISTORY_FILE = 'history.jsonl'

/** Route dependencies resolved by the node half at apply time. */
export interface RouteDeps {
  /** Harness-home joiner: `dshHomePath(...segments)`, when present. */
  homePath: ((...segments: string[]) => string) | undefined
  /** Resolve the profile patch file path to prefill from, when available. */
  profilePatchPath: (() => string) | undefined
  config: ProbeConfig
  /** In-process gate remembering confirmed custom executable paths (§3.6.2). */
  commandGate: CustomCommandGate
}

/** A JSON response helper. */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Loopback host names (not just literal IPs) blocked when allowLocal is false. */
const LOCALHOST_NAMES = new Set(['localhost', 'ip6-localhost', 'ip6-loopback'])

/**
 * Whether *hostname* is a non-public (loopback / private / link-local) literal
 * address or a loopback name. This is a defense-in-depth second check behind
 * the CLI: it catches literal IPs and `localhost`, but NOT a domain name that
 * resolves to a private address (no DNS is performed here; the CLI remains the
 * primary guard for that case). WHATWG URL already normalizes decimal/hex/octal
 * IPv4 encodings to dotted form before this runs.
 * @param hostname - the URL's hostname (brackets tolerated for IPv6).
 * @returns true when the address is loopback, private, or link-local.
 */
export function isNonPublicHost(hostname: string): boolean {
  let h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (LOCALHOST_NAMES.has(h)) return true

  // IPv4-mapped IPv6, dotted form (::ffff:192.168.1.1) -> inspect embedded v4.
  const mappedDotted = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (mappedDotted) return isPrivateIPv4(mappedDotted[1])
  // IPv4-mapped IPv6, hex form (::ffff:7f00:1) -> decode the two hextets.
  const mappedHex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16), lo = parseInt(mappedHex[2], 16)
    return isPrivateIPv4(`${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`)
  }

  // Unspecified / loopback (compact and fully-expanded forms).
  if (h === '::' || h === '::1' || /^(0:){7}1$/.test(h)) return true

  // Range checks keyed on the first hextet.
  const first = firstHextet(h)
  if (first !== null) {
    if (first >= 0xfc00 && first <= 0xfdff) return true // unique-local fc00::/7
    if (first >= 0xfe80 && first <= 0xfebf) return true // link-local fe80::/10
  }

  // Direct dotted IPv4.
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return isPrivateIPv4(h)
  return false
}

/** The numeric value of the first IPv6 hextet (0 for a leading `::`). */
function firstHextet(h: string): number | null {
  if (h.startsWith('::')) return 0
  const m = h.match(/^([0-9a-f]{1,4})[:.]/)
  return m ? parseInt(m[1], 16) : null
}

/** Whether a dotted-quad IPv4 address is loopback, private, or link-local. An
 * invalid octet fails closed (blocked) rather than being treated as public. */
function isPrivateIPv4(ip: string): boolean {
  const o = ip.split('.').map((x) => Number(x))
  if (o.some((n) => n < 0 || n > 255)) return true
  const [a, b] = o
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

/** Resolve the history file path, falling back to `~/.dsh/model-probe/`. */
function historyFile(deps: RouteDeps): string {
  if (typeof deps.homePath === 'function') {
    const root = deps.homePath(STATE_DIR)
    if (typeof root === 'string' && root.length > 0) return join(root, HISTORY_FILE)
  }
  return join(homedir(), '.dsh', STATE_DIR, HISTORY_FILE)
}

/** GET /api/model-probe/endpoints: best-effort prefill, host only. */
async function handleEndpoints(deps: RouteDeps): Promise<Response> {
  let endpoints: ReturnType<typeof parseProfileProviders> = []
  if (typeof deps.profilePatchPath === 'function') {
    try {
      const text = await readFile(deps.profilePatchPath(), 'utf8')
      endpoints = parseProfileProviders(text)
    } catch {
      endpoints = []
    }
  }
  const command = resolveCommand(deps.config.command)
  return json(200, {
    endpoints,
    defaults: {
      command,
      customCommand: !isDefaultCommand(deps.config.command),
      maxRequests: deps.config.maxRequests,
      totalTimeout: deps.config.totalTimeout,
      allowLocal: deps.config.allowLocal,
    },
  })
}

/** POST /api/model-probe/verify: run the probe, store a history row, reply. */
async function handleVerify(deps: RouteDeps, body: VerifiedVerifyBody): Promise<Response> {
  const { baseUrl, model } = body
  let parsedUrl: URL
  try {
    parsedUrl = new URL(baseUrl)
  } catch {
    return json(400, { error: 'invalid_url', message: 'baseUrl must be an http(s) URL' })
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return json(400, { error: 'invalid_url', message: 'baseUrl must be http(s)' })
  }
  // Reject embedded credentials: they would be passed as the --base-url argv
  // value and could be visible in the local process list.
  if (parsedUrl.username !== '' || parsedUrl.password !== '') {
    return json(400, {
      error: 'url_userinfo_blocked',
      message: 'do not embed credentials in baseUrl; pass the key via the apiKey field',
    })
  }

  const allowLocal = body.allowLocal || deps.config.allowLocal

  // Defense-in-depth behind the CLI: unless local probing is explicitly allowed,
  // reject a literal loopback/private/link-local address at the plugin layer.
  if (!allowLocal && isNonPublicHost(parsedUrl.hostname)) {
    return json(400, {
      error: 'local_address_blocked',
      message: 'loopback/private/link-local addresses are blocked unless allowLocal is set',
    })
  }

  // §3.6.2: a custom executable path is a code-execution surface; require an
  // explicit one-time confirmation before the first spawn (remembered in-process).
  const command = resolveCommand(deps.config.command)
  const decision = deps.commandGate.check(command, body.confirmCustomCommand)
  if (!decision.ok) {
    return json(409, {
      error: 'custom_command_unconfirmed',
      message: '自定义可执行路径=代码执行面：请在确认其可信后勾选确认再运行。',
    })
  }

  const routing = resolveKeyRouting(body.apiKey, body.apiKeyEnv)
  const args = withApiKeyEnv(
    buildVerifyArgs({
      baseUrl,
      model,
      maxRequests: deps.config.maxRequests,
      totalTimeout: deps.config.totalTimeout,
      allowLocal,
    }),
    routing,
  )
  const env = buildChildEnv(process.env, routing)

  const result = await runVerify({
    command,
    args,
    env,
    timeoutMs: (deps.config.totalTimeout + 20) * 1000,
  })

  let normalized
  try {
    normalized = normalizeVerifyReport(parseVerifyReport(result.stdout))
  } catch {
    // No usable report: fail closed as insufficient_evidence with an internal code.
    normalized = normalizeVerifyReport({
      claimed_model: model,
      endpoint_base_url: hostOfUrl(baseUrl),
      verdict: 'insufficient_evidence',
      error: { code: 'no_report', message: 'CLI produced no usable JSON report.' },
    })
  }

  const resolved = resolveFinalVerdict(result.code, normalized)
  // A spawn failure (ENOENT/EACCES) has no CLI report; surface its code so the
  // operator can tell "command missing" from "the CLI ran but found nothing".
  const effectiveErrorCode = result.spawnErrorCode
    ? `spawn_${result.spawnErrorCode.toLowerCase()}`
    : resolved.errorCode
  const verdict = resolved.verdict

  await appendEntry(historyFile(deps), {
    id: makeId(),
    timestamp: normalized.timestamp,
    host: normalized.endpointHost || hostOfUrl(baseUrl),
    model,
    verdict,
    confidence: normalized.confidence,
    posterior: normalized.summary.posterior,
    tokenizerVerdict: normalized.summary.tokenizer?.verdict ?? null,
    behavioralSamples: normalized.summary.behavioralSamples,
    requestsUsed: normalized.summary.requestsUsed,
    errorCode: effectiveErrorCode,
  })

  // A non-zero exit or an unusable report surfaces install guidance so the
  // user is not left with a silent failure; a clean pass carries no hint.
  const failed = result.code !== 0 || normalized.error !== null || result.timedOut
  return json(200, {
    report: normalized,
    verdict,
    errorCode: effectiveErrorCode,
    timedOut: result.timedOut,
    installHint: failed
      ? '未检测到可用的 transit-truth CLI 或本次核验失败：内核尚未发布到 PyPI，请通过配置项 command 指向本地检出的 transit-truth，确认其在 PATH 后重试。'
        + ' / No usable transit-truth CLI was found, or this verification failed: the kernel is not on PyPI yet; point the `command` setting at a local checkout of transit-truth, make sure it is on PATH, and retry.'
      : null,
  })
}

/** GET /api/model-probe/history: newest-first rows, host only. */
async function handleHistory(deps: RouteDeps): Promise<Response> {
  const rows = await readHistory(historyFile(deps))
  return json(200, { history: [...rows].reverse() })
}

/**
 * Register the three routes on the connection channel when the host provides
 * it; a host without the channel simply has no routes and the page shows a
 * setup note.
 * @param ctx - registrant context.
 * @param deps - resolved route dependencies.
 */
export function registerProbeRoutes(ctx: LooseContext, deps: RouteDeps): void {
  ctx.inject(['connection'], (scope) => {
    const channel = scope.get('connection') as { fetch?: { register: (route: ConnectionRoute) => () => unknown } } | undefined
    const fetchApi = channel?.fetch
    const register = fetchApi?.register
    if (typeof register !== 'function' || fetchApi === undefined) return
    const registered = register.bind(fetchApi) as (route: ConnectionRoute) => () => unknown
    scope.effect(() => {
      const disposers: Array<() => unknown> = []
      const route = (r: Omit<ConnectionRoute, 'fetch'>, fetch: ConnectionRoute['fetch']) => {
        disposers.push(registered({ ...r, fetch }))
      }
      route(
        { path: '/api/model-probe/endpoints', methods: ['GET'], requestBody: 'buffered' },
        () => handleEndpoints(deps),
      )
      route(
        { path: '/api/model-probe/verify', methods: ['POST'], requestBody: 'buffered' },
        async (request) => {
          const contentType = (request.headers.get('content-type') ?? '').toLowerCase()
          if (!contentType.startsWith('application/json')) {
            return json(415, { error: 'unsupported-media-type' })
          }
          // Read the raw text so the measured byte count governs the 256KB cap
          // (a lied-about Content-Length or chunked stream cannot bypass it).
          const raw = await request.text()
          const parsed = parseVerifyRequestBody(raw)
          if (!parsed.ok) {
            return json(parsed.status, { error: parsed.error, message: parsed.message })
          }
          return handleVerify(deps, parsed.body)
        },
      )
      route(
        { path: '/api/model-probe/history', methods: ['GET'], requestBody: 'buffered' },
        () => handleHistory(deps),
      )
      return () => disposers.forEach(dispose => dispose())
    }, 'dsh-model-probe: api routes')
  })
}
