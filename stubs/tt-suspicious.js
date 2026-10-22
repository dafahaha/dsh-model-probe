/**
 * Dev-only forged stub: mimics `transit-truth verify` returning `suspicious`.
 * Emits a canned suspicious report on stdout and exits 3 (the kernel's
 * suspicious exit code). Reads no key, makes no network call; it only exercises
 * the bridge's suspicious path (exit 3 -> red badge).
 *
 * Run: node stubs/tt-suspicious.js
 */
const report = {
  schema: 'transit-truth/verify-report/v1',
  claimed_model: 'gpt-4o-mini',
  endpoint_base_url: 'https://relay.example',
  timestamp: '2026-10-19T03:01:00Z',
  verdict: 'suspicious',
  confidence: 'high',
  sample_sizes: {
    tokenizer_probes: 5,
    behavioral_samples: 8,
    requests_used: 17,
    request_failures: 0,
  },
  statistics: {
    matched_reference_model: null,
    posterior: 0.12,
    posterior_ci_95: [0.05, 0.24],
    tokenizer_consistency: { verdict: 'mismatch', score: 0.2, overlap: 5, consistent: 1 },
    behavioral_evidence: 'overlap',
  },
  observations: { tokenizer: {}, behavioral: {} },
  evidence_reason: 'Observed fingerprint differs significantly from the reference (likely family mismatch).',
  error: null,
  disclaimer: 'Probabilistic auxiliary evidence; not a verdict on authenticity.',
}
process.stdout.write(JSON.stringify(report))
process.exit(3)
