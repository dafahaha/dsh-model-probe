import { describe, expect, it } from 'vitest'
import { parseProfileProviders } from '../src/endpoints.ts'

const FIXTURE = `
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        models:
          - id: legacy-chat
          - id: vision-preview
      second:
        baseURL: https://second.example/v1
        models:
          - id: model-a
`

describe('parseProfileProviders', () => {
  it('reads providers, baseURL, apiKeyEnv and model ids', () => {
    const out = parseProfileProviders(FIXTURE)
    const first = out.find(e => e.providerId === 'my-gateway')
    expect(first?.baseUrl).toBe('https://gateway.example/v1')
    expect(first?.apiKeyEnv).toBe('GATEWAY_API_KEY')
    expect(first?.host).toBe('gateway.example')
    const models = out.filter(e => e.providerId === 'my-gateway').map(e => e.modelId)
    expect(models).toEqual(['legacy-chat', 'vision-preview'])
  })

  it('keeps a provider without models as a single empty model row', () => {
    const out = parseProfileProviders(`
- id: llm-pi-ai
  config:
    providers:
      solo:
        baseURL: https://solo.example/v1
`)
    expect(out).toHaveLength(1)
    expect(out[0]?.modelId).toBe('')
  })

  it('returns empty for blank or unrelated text', () => {
    expect(parseProfileProviders('')).toEqual([])
    expect(parseProfileProviders('# just a comment\n')).toEqual([])
  })
})
