# dsh-model-probe

<p align="center"><a href="README.md">简体中文</a> · <strong>English</strong></p>

One-click TransitTruth model-identity probe for the currently configured endpoint inside the DeepSeek Harness (DSH) Web console: a three-state badge (pass / suspicious / insufficient_evidence), an evidence summary, and an append-only local history.

This plugin is a **thin bridge**: it implements no verification logic of its own. It only bridges DSH actions to the local `transit-truth verify` CLI. The API key is **never written to disk, logged, or included in a report**.

> Probabilistic auxiliary evidence, not an authenticity verdict; tokenizer counts are a weak self-reported signal. This plugin never rates or names any commercial provider.

## Prerequisites

1. **Python 3.10+** and the TransitTruth CLI available on PATH as `transit-truth`.

   > Honest status (2026-10-22): the kernel is **not yet published to PyPI**, so
   > `pip install transit-truth` does not work today. Point the plugin at a local
   > checkout of the kernel via config `command`, or wait for the kernel release.
   > The plugin degrades to an `insufficient_evidence` "CLI missing" hint instead
   > of crashing when the executable is absent. This plugin is a **companion only**:
   > it implements no verification logic and cannot verify anything on its own.

2. An OpenAI-compatible endpoint Base URL, the claimed model name, and (optionally) an API key.

> Without a key the kernel returns a `missing_api_key` error report (`insufficient_evidence`) and probes nothing. A tokenizer-only catalog match still caps at `insufficient_evidence` and is not a certification.

## Honest disclosure (release status)

- **The npm name is taken; this project is NOT published to npm.** The npm
  package name `dsh-model-probe` is already registered by someone else (a
  different, deprecated package unrelated to this project); this repo never runs
  `npm publish` and does not claim that name.
- **The kernel is not on PyPI; this plugin is a companion.** All verification
  comes from the local `transit-truth` kernel CLI. The kernel is not published
  to PyPI, so this plugin cannot provide verification on its own and must be
  used alongside a local kernel checkout.
- **Real-host live testing is pending.** No end-to-end live test has been run
  against a real dsh-tui 0.16.x host; loopback + Host + Origin enforcement is
  the host channel's responsibility, not this module's.

## Install

Local source install only (alongside a local kernel checkout). From this repository directory run:

```sh
dsh plugin --profile web add .
# restart and refresh if dsh web is already running
```

Use `dsh --profile web --dump-config` to confirm the plugin entered the final config.
This package is not on npm; there is no `dsh plugin add dsh-model-probe` npm install path.

## Usage

1. Open **Settings → Model Probe**.
2. The form best-effort prefills configured custom providers (read-only from `llm-pi-ai` providers in `$DSH_HOME/profiles/web/cordis.patch.yml`: Base URL, model id, `apiKeyEnv` name only; fall back to manual entry when nothing parses).
3. Pick or fill the endpoint and click **Probe current endpoint**:
   - a pasted key lives only in memory for this run and reaches the CLI through a throwaway child env var — never persisted, never logged;
   - alternatively enter an existing env var name (e.g. `GATEWAY_API_KEY`) that the CLI reads itself; this plugin never reads its value.
   - Tick the local self-test option (`--allow-local`) only for loopback/private targets; it is off by default and not needed for public endpoints.
4. The result area shows the badge, posterior with 95% CI, matched reference model, tokenizer signal, behavioral samples / requests used, and the reason; below it sits the host-only append-only history. On failure or when the CLI is missing, the result area shows an honest setup hint (point `command` at the local kernel checkout; the kernel is not on PyPI yet) instead of failing silently.

## Three states

| verdict | meaning | badge |
| --- | --- | --- |
| `pass` | observed fingerprint statistically consistent with the reference | green |
| `suspicious` | observed fingerprint differs significantly (e.g. wrong family) | red |
| `insufficient_evidence` | no reference, sample too small, or an error — no guessing | gray |

> The exit codes below belong to the **transit-truth kernel CLI**, not this
> plugin: the plugin HTTP response is always 200; trust the JSON `verdict`
> field rather than the HTTP status.

Exit codes (kernel CLI): `0` = pass or insufficient_evidence (distinguish via the JSON `verdict` field), `3` = suspicious, `2` = execution error.

## Privacy & security

- The key travels only through a throwaway child env var: never persisted, never logged, never in a report; errors and stderr are redacted before leaving the bridge.
- History stores the **host only** (plus a non-default port) — never the key, full URL, path, or query.
- The plugin calls the local CLI only; it does not forward user traffic or upload reports.

## Honest limits

- A black-box result is **probabilistic auxiliary evidence, not a cryptographic proof and not an authenticity verdict**; public probes can be hard-coded and temperature=0 baselines replayed deterministically.
- Tokenizer counts are self-reported in `usage.prompt_tokens` and are a **weak signal**; the behavioral fingerprint is the primary judge.
- DSH v0.1 interfaces may still break; this plugin isolates the volatile layer in an adapter shell.
- No closed-model signature fingerprint library, no automatic request blocking, no naming of any site.

## Development

```sh
npm install --legacy-peer-deps   # local npm arborist crashes on peer resolution; bypass it
npm run typecheck
npm run test                     # vitest
npm run build                   # tsdown -> lib/index.js + lib/client.js
npm run check                   # typecheck + test + build
```

Pure-logic unit tests cover: verify JSON parsing, three-state mapping, append-only history, key redaction, endpoint prefill parsing, and spawn argument building. The three stubs under `stubs/` (pass / suspicious / error) validate the bridge without Python, a key, or network.

## Release stance (not published to npm)

1. **No `npm publish`**: the npm name `dsh-model-probe` is taken by another, deprecated package; this project does not squat on it or publish to npm.
2. The `transit-truth` kernel is not on PyPI; this plugin is a companion installed locally alongside the kernel source, not distributed standalone.
3. Real dsh-tui 0.16.x host live testing is pending; no directory-indexing claim is made before then.
4. Local gates pass: `npm run typecheck`, `npm run test`, `npm run build`, `npm run verify` (official verify-plugin static gate, 0 FAIL), and `npm run pack` (dry-run).

## License

MIT (the TransitTruth kernel is also MIT; this wrapper does not modify its verification logic).
