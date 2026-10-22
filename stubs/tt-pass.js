/**
 * Dev-only honest stub: mimics `transit-truth verify` on stdout for bridge
 * testing. Emits a canned `pass` report on stdout and exits 0. It reads no key
 * and makes no network call; it exists only to exercise the plugin bridge
 * (spawn -> parse -> three-state map -> history) without Python or a live key.
 *
 * Run: node stubs/tt-pass.js
 */
const report = {
  schema: 'transit-truth/verify-report/v1',
  claimed_model: 'gpt-4o-mini',
  endpoint_base_url: 'https://relay.example',
  timestamp: '2026-10-19T03:00:00Z',
  verdict: 'pass',
  confidence: 'high',
  sample_sizes: {
    tokenizer_probes: 5,
    behavioral_samples: 8,
    requests_used: 17,
    request_failures: 0,
  },
  statistics: {
    matched_reference_model: 'gpt-4o-mini',
    posterior: 0.87,
    posterior_ci_95: [0.71, 0.95],
    tokenizer_consistency: { verdict: 'match', score: 1.0, overlap: 5, consistent: 5 },
    behavioral_evidence: 'overlap',
  },
  observations: { tokenizer: {}, behavioral: {} },
  evidence_reason: 'Observed fingerprint is statistically consistent with the reference.',
  error: null,
  disclaimer: 'Probabilistic auxiliary evidence; not a verdict on authenticity.',
}
process.stdout.write(JSON.stringify(report))
process.exit(0)
