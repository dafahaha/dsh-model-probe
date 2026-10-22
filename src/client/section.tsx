/**
 * The settings section: endpoint form, one-click probe, three-state badge with
 * evidence summary, and the append-only history list. The fixed honesty note
 * always renders under the badge; this page never rates any commercial
 * provider by name.
 *
 * @module dsh-model-probe/client/section
 */

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  fetchEndpoints,
  fetchHistory,
  verifyEndpoint,
  type VerifyAnswer,
} from './api.ts'
import { Badge } from './badge.tsx'
import type { HistoryEntry, PrefilledEndpoint, Verdict } from '../types.ts'

/** Fixed honesty note under the badge, bilingual. */
const HONESTY_NOTE =
  '概率性核验、不构成真伪裁判；tokenizer 为弱信号。 / '
  + 'Probabilistic auxiliary evidence, not an authenticity verdict; tokenizer counts are a weak self-reported signal.'

/** Format an ISO timestamp for a row. */
function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/** A small labeled row in the evidence panel. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: '13px', margin: '3px 0' }}>
      <span style={{ color: '#888', minWidth: 130 }}>{label}</span>
      <span>{children}</span>
    </div>
  )
}

/** Format a posterior with its 95% CI when present. */
function posteriorText(value: number | null, ci: [number, number] | null): string {
  if (value === null) return 'NA'
  const base = `posterior ${(value * 100).toFixed(1)}%`
  return ci ? `${base} (95% CI ${(ci[0] * 100).toFixed(1)}%–${(ci[1] * 100).toFixed(1)}%)` : base
}

/**
 * The section component mounted by the slot registration.
 */
export function ModelProbeSection() {
  const [endpoints, setEndpoints] = useState<PrefilledEndpoint[]>([])
  const [commandInfo, setCommandInfo] = useState<{ command: string; custom: boolean }>({
    command: 'transit-truth',
    custom: false,
  })
  const [confirmCustom, setConfirmCustom] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyEnv, setApiKeyEnv] = useState('')
  const [allowLocal, setAllowLocal] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyAnswer | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  // Ref-based submit mutex (DSH Standard §4.2.6): guards against a double
  // submit even when the state-driven disabled flag races a fast double click.
  const runningRef = useRef(false)

  useEffect(() => {
    let alive = true
    fetchEndpoints()
      .then(answer => {
        if (!alive) return
        setEndpoints(answer.endpoints)
        setCommandInfo({ command: answer.defaults.command, custom: answer.defaults.customCommand })
      })
      .catch(() => undefined)
    fetchHistory()
      .then(rows => { if (alive) setHistory(rows) })
      .catch(() => undefined)
    return () => { alive = false }
  }, [])

  const reloadHistory = () => {
    fetchHistory().then(setHistory).catch(() => undefined)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (runningRef.current) return
    // §3.6.2: a custom executable path is a code-execution surface; require
    // explicit one-time (session-memory) consent before spawning it.
    if (commandInfo.custom && !confirmCustom) {
      setError('自定义可执行路径=代码执行面：请先勾选确认该可执行路径可信，再运行核验。')
      return
    }
    runningRef.current = true
    setError(null)
    setRunning(true)
    try {
      const answer = await verifyEndpoint({
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        ...apiKey.trim() ? { apiKey: apiKey.trim() } : {},
        ...apiKeyEnv.trim() ? { apiKeyEnv: apiKeyEnv.trim() } : {},
        ...(allowLocal ? { allowLocal: true } : {}),
        ...(commandInfo.custom ? { confirmCustomCommand: true } : {}),
      })
      setResult(answer)
      reloadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid rgba(128,128,128,0.4)',
    background: 'transparent',
    color: 'inherit',
    fontSize: '13px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 2px' }}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {endpoints.length > 0 && (
          <label style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            已配置端点（点选后自动填入）
            <select
              style={inputStyle}
              defaultValue=""
              onChange={event => {
                const picked = endpoints.find(e => `${e.providerId}/${e.modelId}` === event.target.value)
                if (!picked) return
                setBaseUrl(picked.baseUrl)
                setModel(picked.modelId)
                setApiKeyEnv(picked.apiKeyEnv ?? '')
              }}
            >
              <option value="" disabled>选择一个已配置提供商…</option>
              {endpoints.map(e => (
                <option key={`${e.providerId}/${e.modelId}`} value={`${e.providerId}/${e.modelId}`}>
                  {e.providerId} · {e.modelId || '(未命名模型)'}
                </option>
              ))}
            </select>
          </label>
        )}

        <label style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          基础 URL（Base URL）
          <input
            style={inputStyle}
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://relay.example/v1"
            required
          />
        </label>

        <label style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          声称的模型（Claimed model）
          <input
            style={inputStyle}
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            required
          />
        </label>

        <label style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          API 密钥（仅本次内存，不落盘、不进日志；也可填环境变量名）
          <input
            style={inputStyle}
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-…（留空则使用环境变量）"
            autoComplete="off"
          />
        </label>

        <label style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          环境变量名（已存密钥；优先级低于直接填写）
          <input
            style={inputStyle}
            value={apiKeyEnv}
            onChange={e => setApiKeyEnv(e.target.value)}
            placeholder="例如 GATEWAY_API_KEY"
            autoComplete="off"
          />
        </label>

        <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={allowLocal}
            onChange={e => setAllowLocal(e.target.checked)}
          />
          允许本机/环来自测（--allow-local，默认关闭；仅对 127.0.0.1 / 私有地址使用）
        </label>

        {/* §3.6.2: custom executable path = code-execution surface. The label
            always renders; a confirmed checkbox is required when deployment
            config points `command` at a non-default path. */}
        <div style={{ fontSize: '12px', color: commandInfo.custom ? '#b45309' : '#888' }}>
          自定义可执行路径=代码执行面：自定义 `command` 将以本插件进程权限启动外部程序，仅可填写你信任的可执行文件。
          {!commandInfo.custom && `（当前使用 PATH 上的默认 transit-truth）`}
        </div>

        {commandInfo.custom && (
          <label style={{ fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <input
              type="checkbox"
              checked={confirmCustom}
              onChange={e => setConfirmCustom(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              我确认自定义可执行路径可信（`{commandInfo.command}`），允许本次启动；确认仅记忆于本次会话。
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={running}
          style={{
            alignSelf: 'flex-start',
            padding: '7px 16px',
            borderRadius: 6,
            border: 'none',
            cursor: running ? 'not-allowed' : 'pointer',
            background: running ? 'rgba(128,128,128,0.3)' : '#2563eb',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {running ? '核验中…' : '一键核验当前端点'}
        </button>
      </form>

      {error && (
        <div style={{ fontSize: '13px', color: '#dc2626' }}>错误：{error}</div>
      )}

      <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{HONESTY_NOTE}</p>

      {result && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid rgba(128,128,128,0.25)', paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge verdict={result.verdict as Verdict} />
            <span style={{ fontSize: '13px', color: '#888' }}>
              {result.report.claimedModel} · {result.report.endpointHost}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#888', margin: '2px 0' }}>{HONESTY_NOTE}</p>

          <Field label="后验概率">{posteriorText(result.report.summary.posterior, result.report.summary.posteriorCi95)}</Field>
          <Field label="参考模型">{result.report.summary.matchedReferenceModel ?? '无参考基线'}</Field>
          <Field label="tokenizer 信号">
            {result.report.summary.tokenizer
              ? `${result.report.summary.tokenizer.verdict}（${result.report.summary.tokenizer.consistent}/${result.report.summary.tokenizer.overlap} 一致，score ${result.report.summary.tokenizer.score ?? 'NA'}）`
              : '无 tokenizer 数据'}
          </Field>
          <Field label="行为样本 / 请求">
            {result.report.summary.behavioralSamples} 样本 · 用 {result.report.summary.requestsUsed} 请求 · 失败 {result.report.summary.requestFailures}
          </Field>
          {result.report.error && (
            <Field label="错误">{result.report.error.code}：{result.report.error.message}</Field>
          )}
          {result.report.evidenceReason && (
            <Field label="说明">
              <span style={{ color: '#666' }}>{result.report.evidenceReason}</span>
            </Field>
          )}
          {result.timedOut && <div style={{ fontSize: '12px', color: '#b45309' }}>整体超时，已按证据不足关闭（fail-closed）。</div>}
          {result.installHint && (
            <div style={{ fontSize: '12px', color: '#b45309' }}>{result.installHint}</div>
          )}
        </section>
      )}

      <section style={{ borderTop: '1px solid rgba(128,128,128,0.25)', paddingTop: 10 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>历史记录（仅主机名，append-only）</h4>
        {history.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>暂无记录。</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map(row => (
              <li key={row.id} style={{ fontSize: '12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge verdict={row.verdict} />
                <span>{when(row.timestamp)}</span>
                <span style={{ color: '#888' }}>{row.host}</span>
                <span>{row.model}</span>
                {row.posterior !== null && <span style={{ color: '#888' }}>posterior {(row.posterior * 100).toFixed(1)}%</span>}
                {row.tokenizerVerdict && <span style={{ color: '#888' }}>tok:{row.tokenizerVerdict}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
