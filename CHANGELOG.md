# Changelog — dsh-model-probe

## v0.1.2 — Round-5 independent technical review (fresh reviewer, cold reading)
- P2-1 (fixed): a `model`/`apiKeyEnv` value passed as a CLI option was not
  guarded against a leading `-`; model ids starting with `-` are rejected and
  apiKeyEnv must match a normal identifier (`[A-Za-z_][A-Za-z0-9_]*`).
- P2-2 (fixed): added a plugin-layer SSRF guard — literal loopback, private,
  and link-local addresses are blocked unless `allowLocal` is set (the CLI
  remains the primary check; this is defense-in-depth).
- P2-3 (fixed): the runner now redacts stdout as well as stderr, so a
  key-shaped string the CLI ever printed cannot reach the parser/response.
- New tests: model/env-name validation, non-public host detection (IPv4/IPv6/
  mapped), stdout redaction. Suite: 88 -> 95 across 11 files. verify still
  0 FAIL/WARN/INFO; pack still 9 files.

Pre-release, reused from the earlier local draft (58 vitest tests green at v1).

## v1 (baseline, carried over)
- Thin bridge to local `transit-truth verify`; three-state badge; append-only
  host-only JSONL history; key never in argv/disk/log; redaction layer; stubs
  for pass/suspicious/error; 58 tests across 8 files green.

## v2 (honesty metadata + false install hint)
- README (EN/ZH) removed the false `pip install transit-truth` instruction: the
  kernel is not on PyPI yet; prerequisites now state the local-checkout/`command`
  path and the degrade-to-hint behavior. npm install marked pre-release only.
- Runtime `installHint` string (http-routes) also carried the false pip command;
  replaced with an honest "kernel not on PyPI; point `command` at local checkout"
  message.
- package.json 0.1.0 -> 0.1.1; description carries the pre-release note; added
  `engines.node>=18` and placeholder repository/bugs fields for publish gates.

## v3 (privacy fix: endpoint host-only in normalized report) — real bug
- `normalizeVerifyReport` previously copied `endpoint_base_url` verbatim into the
  normalized report; a URL carrying userinfo, path or `?key=` could reach the
  report/history shape. Added `hostOnly()` (scheme-checked, host:port only,
  lowercased, non-http/unparseable -> '') and unit tests for stripping and rejection.
- `hostOfUrl` keeps a defensive `.toLowerCase()` (the URL API already lowercases;
  this is belt-and-suspenders, not a behavior fix).

## v4 (scope check)
- Confirmed no network egress, no key read; no new runtime dependency; `files`
  publish list unchanged.

## v5 (spec compliance + mutation check)
- NOTES.md records DSH Standard v2.0.0 checklist; pending items marked honestly.
- Mutation self-check: bypassing `hostOnly` (return raw URL) turns the two new
  report tests red; reverted, full suite green (61).

## v6 (release-gate hardening, 2026-10-22)
- P1-1: vendored the official `verify-plugin.mjs` static checker into `scripts/`
  (provenance header; logic untouched); added `verify` and `pack` scripts; gate
  exits 0 with 0 FAIL.
- P2-1 (§3.6.4): `buildChildEnv` moved from wholesale `{...process.env}` to a
  platform whitelist (Unix PATH/HOME/TMPDIR; Windows Path/SystemRoot/SystemDrive/
  ComSpec/PATHEXT/USERPROFILE/TEMP/TMP/LOCALAPPDATA/APPDATA) plus the injected
  probe key var; marker secrets no longer reach the child.
- P2-2 (§3.6.2): custom `command` labeled "自定义可执行路径=代码执行面"; one-time
  in-process confirmation gate before the first custom spawn (session memory only).
- P2-3 (§3.3.2): POST body capped at 256KB (413) with strict JSON shape, field
  whitelist and type validation (400); unknown fields rejected.
- P3: emit `lib/client.d.ts` and wire `exports["./client"].types`; `engines.node
  >=22`; `files` trimmed to `lib` + `cordis.patch.yml`; ref-based submit mutex;
  in-process promise-chain lock on JSONL appends.
- Honest disclosure (README zh/en): npm name taken by a deprecated third-party
  package (not published to npm); kernel not on PyPI (companion only); real-host
  live test pending. Placeholder `your-org` URLs replaced with the GitHub repo.
- Tests: 61 -> 88 across 10 files, all green.

## v7 (manifest MUST fix + typecheck no-emit, 2026-10-22)
- Standard §2.1.5 (MUST): `dsh.client.inject` must list the **packages** that
  contribute the browser services, not Cordis service names/frameworks. It was
  `["react"]`; the client source injects the `slots` service, which is provided
  by `@deepseek-ai/dsh-client-ui-slots`. Corrected to that package and added it
  to `peerDependencies` (React stays a shared peer runtime, not a client inject).
- `files` now explicitly lists `README.md`, `README.en.md` and `LICENSE` (clears
  the §2.1.9 SHOULD warning); npm packed file count is unchanged at 9.
- Build hygiene: `tsconfig.json` had `declaration/emitDeclarationOnly/outDir` and
  no `noEmit`, so `npm run typecheck` silently emitted per-module `.d.ts` files
  into `lib/` (a stale build then packed 20 files instead of 9). Added
  `noEmit: true` to the typecheck config and moved declaration emission to a
  dedicated `tsconfig.dts.json`, wired into tsdown's node dts block (mirrors the
  client's `tsconfig.client.dts.json`). Typecheck is now side-effect-free;
  clean build is reproducible (4 lib files, pack 9 / 26.4 kB).
- Gates after v7: verify 0 FAIL / 0 WARN / 0 INFO; tests 88/10 files; typecheck
  and pack green.
