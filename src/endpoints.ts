/**
 * Best-effort read of the profile patch (`$DSH_HOME/profiles/<profile>/cordis.patch.yml`)
 * to prefill the probe form with already-configured custom providers. This is
 * a tolerant subset parser for the `llm-pi-ai` `config.providers` block only;
 * it never reads a stored key, and manual entry always works when parsing
 * yields nothing.
 *
 * @module dsh-model-probe/endpoints
 */

import { hostOfUrl } from './history.ts'
import type { PrefilledEndpoint } from './types.ts'

/** A provider row as parsed from the patch. */
interface ParsedProvider {
  id: string
  baseUrl: string | null
  apiKeyEnv: string | null
  models: string[]
}

/** Strip a trailing comment and surrounding quotes/whitespace from a scalar. */
function scalar(line: string): string | null {
  const colon = line.indexOf(':')
  if (colon === -1) return null
  let value = line.slice(colon + 1).trim()
  // Drop an inline `# comment` not inside quotes.
  const quote = /^["']/
  if (!quote.test(value)) {
    const hash = value.indexOf(' #')
    if (hash !== -1) value = value.slice(0, hash).trim()
  }
  value = value.replace(/^["']|["']$/g, '')
  return value.length > 0 ? value : null
}

/**
 * Parse the `llm-pi-ai` providers block from patch text. Anything outside
 * that shape is ignored; malformed lines are skipped rather than thrown.
 * @param text - raw cordis.patch.yml text.
 * @returns prefilled endpoints (one per provider × model), host only.
 */
export function parseProfileProviders(text: string): PrefilledEndpoint[] {
  const providers: ParsedProvider[] = []
  let inPiAi = false
  let current: ParsedProvider | null = null
  let inModels = false

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\t/g, '    ')
    const indent = line.match(/^ */)![0].length
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue

    // Enter the llm-pi-ai row anywhere in the patch.
    if (/^-\s*id:\s*llm-pi-ai\b/.test(trimmed)) {
      inPiAi = true
      inModels = false
      continue
    }
    // A new top-level bundle row leaves the llm-pi-ai block.
    if (inPiAi && /^-\s+id:/.test(trimmed) && indent === 0) {
      inPiAi = false
      current = null
      continue
    }
    if (!inPiAi) continue

    // Section headers first so a bare `models:`/`providers:` line is never
    // mistaken for a provider name.
    if (trimmed === 'providers:' || trimmed.startsWith('providers:')) {
      inModels = false
      continue
    }
    if (trimmed === 'models:' || trimmed.startsWith('models:')) {
      inModels = true
      continue
    }

    // `baseURL:` / `apiKeyEnv:` belong to the current provider.
    const baseUrl = trimmed.match(/^baseURL:\s*(.+)$/)
    const apiKeyEnv = trimmed.match(/^apiKeyEnv:\s*(.+)$/)
    if (baseUrl || apiKeyEnv) {
      if (!current) continue
      if (baseUrl) current.baseUrl = scalar(`baseURL:${baseUrl[1]}`)
      if (apiKeyEnv) current.apiKeyEnv = scalar(`apiKeyEnv:${apiKeyEnv[1]}`)
      continue
    }

    // A bare indented `name:` line starts a new provider.
    if (/^[A-Za-z0-9_-]+:\s*$/.test(trimmed) && indent >= 4) {
      current = { id: trimmed.slice(0, -1), baseUrl: null, apiKeyEnv: null, models: [] }
      providers.push(current)
      inModels = false
      continue
    }

    // Model id list items: `- id: <model>`.
    const modelMatch = trimmed.match(/^-\s+id:\s*(.+)$/)
    if (modelMatch && inModels && current) {
      const model = scalar(`id:${modelMatch[1]}`)
      if (model) current.models.push(model)
    }
  }

  const out: PrefilledEndpoint[] = []
  for (const provider of providers) {
    if (!provider.baseUrl) continue
    const models = provider.models.length > 0 ? provider.models : ['']
    for (const model of models) {
      out.push({
        providerId: provider.id,
        baseUrl: provider.baseUrl,
        host: hostOfUrl(provider.baseUrl),
        modelId: model,
        apiKeyEnv: provider.apiKeyEnv,
      })
    }
  }
  return out
}
