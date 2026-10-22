/**
 * Dev-only stub: mimics an execution error (exit 2) with a fail-closed
 * insufficient_evidence report. Reads no key, makes no network call; it only
 * exercises the bridge's error path (exit 2 -> insufficient_evidence).
 *
 * Run: node stubs/tt-error.js
 */
const report = {
  schema: 'transit-truth/verify-report/v1',
  claimed_model: 'gpt-4o-mini',
  endpoint_base_url: 'https://relay.example',
  timestamp: '2026-10-19T03:02:00Z',
  verdict: 'insufficient_evidence',
  confidence: 'low',
  sample_sizes: {},
  statistics: null,
  observations: {},
  evidence_reason: 'Verification could not be completed due to an error.',
  error: { code: 'transport_error', message: 'Could not reach the endpoint (FetchError).' },
  disclaimer: 'Probabilistic auxiliary evidence; not a verdict on authenticity.',
}
process.stdout.write(JSON.stringify(report))
process.exit(2)
