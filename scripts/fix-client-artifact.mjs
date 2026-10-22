#!/usr/bin/env node
/**
 * Post-build artifact tidy for the browser client.
 *
 * tsdown emits the declaration pass as `lib/client.d.cts` (CJS declaration)
 * alongside an un-bannered `lib/client.cjs`; the host bundle must be
 * `lib/client.js` (bannered, emitted by the main client block) and the
 * declaration entry must resolve to `lib/client.d.ts` (see exports["./client"]
 * in package.json). This script removes the throwaway `.cjs` and renames the
 * declaration file; it is idempotent and skips missing files.
 *
 * @module scripts/fix-client-artifact
 */
import { existsSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const libDir = join(process.cwd(), 'lib')

const throwawayJs = join(libDir, 'client.cjs')
if (existsSync(throwawayJs)) unlinkSync(throwawayJs)

const srcDts = join(libDir, 'client.d.cts')
const destDts = join(libDir, 'client.d.ts')
if (existsSync(srcDts)) {
  if (existsSync(destDts)) unlinkSync(destDts)
  renameSync(srcDts, destDts)
}

if (!existsSync(destDts)) {
  console.error('[fix-client-artifact] expected lib/client.d.ts after tidy')
  process.exit(1)
}
console.log('[fix-client-artifact] client artifacts tidied: lib/client.js + lib/client.d.ts')
