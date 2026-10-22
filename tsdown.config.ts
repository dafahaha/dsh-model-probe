/**
 * tsdown preset for dsh-model-probe: an ESM node half (lib/index.js) with
 * declarations plus a browser half (lib/client.js) wrapped for the harness
 * client-plugin loader. The node half owns the TransitTruth CLI bridge; the
 * browser half renders the settings-section badge, evidence summary and history.
 *
 * React and its runtime are resolved from the web shell's frozen module table,
 * so they stay external in the browser bundle; everything else is inlined.
 *
 * The client JavaScript bundle and the client declaration pass are separate
 * blocks: the bundle block carries the loader banner/intro, which makes the
 * dts analyzer emit an empty stub, so declarations come from a minimal pass
 * and are renamed to lib/client.d.ts by scripts/fix-client-artifact.mjs.
 */
import type { UserConfig } from 'tsdown'

const PLUGIN_ID = 'dsh-model-probe'

/** Module specifiers the dsh web shell shares into its frozen module table. */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
] as const

export default [
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: true,
  },
  {
    // Browser bundle: lib/client.js, served by the harness at /plugins/<id>/client.js.
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    deps: { neverBundle: [...PLATFORM_MODULES] },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: `return module.exports; } });`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
  {
    // Declaration-only pass for the client (Standard §2.3.2): minimal config so
    // the dts analyzer emits real declarations; the throwaway .cjs and the
    // .d.cts are tidied by scripts/fix-client-artifact.mjs.
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    clean: false,
    dts: { tsconfig: './tsconfig.client.dts.json' },
    deps: { neverBundle: [...PLATFORM_MODULES] },
  },
] satisfies UserConfig[]
