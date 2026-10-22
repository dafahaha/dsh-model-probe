/**
 * Dev-only walkthrough: drive the three canned stubs through the real bridge
 * (runVerify -> parse -> normalize -> resolveFinalVerdict) and print a readable
 * transcript. No network, no key. Used only to produce an evidence log.
 *
 * Run: node --experimental-strip-types stubs/drive-demo.ts
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runVerify } from '../src/probe-runner.ts'
import { normalizeVerifyReport, parseVerifyReport, resolveFinalVerdict } from '../src/report.ts'

const here = dirname(fileURLToPath(import.meta.url))

async function drive(stub: string) {
  const result = await runVerify({
    command: process.execPath,
    args: [join(here, stub)],
    env: {},
    timeoutMs: 5000,
  })
  const normalized = normalizeVerifyReport(parseVerifyReport(result.stdout))
  const resolved = resolveFinalVerdict(result.code, normalized)
  return { code: result.code, normalized, resolved }
}

const cases: Array<[string, string]> = [
  ['PASS', 'tt-pass.js'],
  ['SUSPICIOUS', 'tt-suspicious.js'],
  ['ERROR (fail-closed)', 'tt-error.js'],
]

for (const [label, stub] of cases) {
  const { code, normalized, resolved } = await drive(stub)
  console.log(`=== ${label} (exit code ${code}) ===`)
  console.log(`verdict      : ${resolved.verdict}  (errorCode: ${resolved.errorCode})`)
  console.log(`claimed model: ${normalized.claimedModel} | host: ${normalized.endpointHost}`)
  console.log(`posterior    : ${normalized.summary.posterior} | 95% CI: ${JSON.stringify(normalized.summary.posteriorCi95)}`)
  console.log(`tokenizer    : ${JSON.stringify(normalized.summary.tokenizer)}`)
  console.log(`behavioral   : ${normalized.summary.behavioralSamples} samples | requestsUsed: ${normalized.summary.requestsUsed}`)
  console.log(`evidence     : ${normalized.evidenceReason}`)
  console.log('')
}
