/**
 * Append-only local history: one JSONL row per probe under the plugin's home
 * directory. Rows are only ever appended; this module offers no update or
 * delete, and a row stores the endpoint host only — never the API key, never
 * the full URL path or query.
 *
 * @module dsh-model-probe/history
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { HistoryEntry } from './types.ts'

/**
 * Reduce a URL to its host label (`hostname` plus a non-default port), with
 * any embedded credentials stripped. A non-http(s) or unparseable input yields
 * `unknown-host` rather than a guess.
 * @param url - endpoint URL as entered or read from the profile.
 * @returns host-only label safe to persist.
 */
/**
 * The kernel already normalizes the endpoint at its source (strips userinfo and
 * path before reporting), so this trimming is defense-in-depth rather than the
 * first line of defense: it keeps a host-only label even if a raw, malformed,
 * or hand-entered URL reaches history directly.
 */
export function hostOfUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'unknown-host'
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'unknown-host'
  // Hostnames are DNS case-insensitive; normalize to lower case so the same
  // host entered as Relay.Example and relay.example does not spawn two history rows.
  const host = parsed.hostname.toLowerCase()
  if (!host) return 'unknown-host'
  const defaultPort = parsed.protocol === 'https:' ? 443 : 80
  if (parsed.port && Number(parsed.port) !== defaultPort) return `${host}:${parsed.port}`
  return host
}

/** A random 12-byte hex row id. */
export function makeId(): string {
  return randomBytes(12).toString('hex')
}

/**
 * In-process promise-chain lock serializing appends to the history file
 * (DSH Standard §3.5.2: serialize concurrent writes to the same resource).
 * Node's `appendFile` already positions at EOF, but chaining guarantees two
 * concurrent callers cannot interleave their mkdir/append operations; the
 * chain holds only for this process lifetime (cross-process safety is out of
 * scope for a single-host local plugin).
 */
let appendChain: Promise<unknown> = Promise.resolve()

/**
 * Append one row to the JSONL history file, creating its directory privately.
 * The file is never rewritten; concurrent appends are serialized by the
 * in-process chain and land as separate lines in submission order.
 * @param filePath - absolute JSONL path.
 * @param entry - row to append (caller fills every field).
 */
export function appendEntry(filePath: string, entry: HistoryEntry): Promise<void> {
  const job = appendChain.then(async () => {
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 })
    await appendFile(filePath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 })
  })
  // Keep the chain alive after a failure so a rejected append never wedges
  // every later append; the caller still receives the original rejection.
  appendChain = job.catch(() => undefined)
  return job
}

/**
 * Read all history rows in file order (oldest first). Blank lines and
 * malformed rows are skipped rather than failing the whole read.
 * @param filePath - absolute JSONL path.
 * @returns rows; empty when the file does not exist or holds nothing valid.
 */
export async function readHistory(filePath: string): Promise<HistoryEntry[]> {
  let text: string
  try {
    text = await readFile(filePath, 'utf8')
  } catch {
    return []
  }
  const rows: HistoryEntry[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    try {
      const row = JSON.parse(trimmed) as HistoryEntry
      if (row && typeof row.id === 'string' && typeof row.verdict === 'string') {
        rows.push(row)
      }
    } catch {
      // Skip a corrupt line; never let one bad row hide the rest.
    }
  }
  return rows
}
