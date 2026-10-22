// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Badge } from '../src/client/badge.tsx'
import { ModelProbeSection } from '../src/client/section.tsx'

describe('Badge', () => {
  it('labels pass in green wording', () => {
    expect(renderToStaticMarkup(<Badge verdict="pass" />)).toContain('Passed')
  })

  it('labels suspicious in red wording', () => {
    expect(renderToStaticMarkup(<Badge verdict="suspicious" />)).toContain('Suspicious')
  })

  it('labels insufficient_evidence in gray wording', () => {
    expect(renderToStaticMarkup(<Badge verdict="insufficient_evidence" />)).toContain('Insufficient evidence')
  })
})

describe('ModelProbeSection static markup', () => {
  it('always shows the fixed honesty note', () => {
    const markup = renderToStaticMarkup(<ModelProbeSection />)
    expect(markup).toContain('概率性核验')
    expect(markup).toContain('not an authenticity verdict')
  })

  it('renders the endpoint form and the probe button', () => {
    const markup = renderToStaticMarkup(<ModelProbeSection />)
    expect(markup).toContain('Base URL')
    expect(markup).toContain('Claimed model')
    expect(markup).toContain('一键核验当前端点')
  })

  it('renders the empty-history state', () => {
    const markup = renderToStaticMarkup(<ModelProbeSection />)
    expect(markup).toContain('历史记录')
    expect(markup).toContain('暂无记录')
  })

  it('always labels the custom executable path as a code-execution surface (§3.6.2)', () => {
    const markup = renderToStaticMarkup(<ModelProbeSection />)
    expect(markup).toContain('自定义可执行路径=代码执行面')
  })
})
