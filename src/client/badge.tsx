/**
 * The three-state badge: green `pass`, red `suspicious`, gray
 * `insufficient_evidence`. Colors are inline so the card follows the host
 * theme without depending on a UI kit.
 *
 * @module dsh-model-probe/client/badge
 */

import type { Verdict } from '../types.ts'

/** Badge label per verdict, bilingual. */
const LABELS: Record<Verdict, string> = {
  pass: '通过 · Passed',
  suspicious: '可疑 · Suspicious',
  insufficient_evidence: '证据不足 · Insufficient evidence',
}

/** Badge chip style per verdict. */
const STYLES: Record<Verdict, { background: string; color: string; border: string }> = {
  pass: { background: 'rgba(34,197,94,0.14)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.45)' },
  suspicious: { background: 'rgba(239,68,68,0.14)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.45)' },
  insufficient_evidence: { background: 'rgba(115,115,115,0.14)', color: '#737373', border: '1px solid rgba(115,115,115,0.4)' },
}

/**
 * Render the three-state badge.
 * @param verdict - resolved verdict.
 * @returns the badge chip.
 */
export function Badge({ verdict }: { verdict: Verdict }) {
  const style = STYLES[verdict] ?? STYLES.insufficient_evidence
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '999px',
        fontSize: '13px',
        fontWeight: 600,
        ...style,
      }}
    >
      {LABELS[verdict] ?? LABELS.insufficient_evidence}
    </span>
  )
}
