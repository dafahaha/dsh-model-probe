# Changelog — dsh-model-probe

## v0.1.9 — Round-12 independent clean review (fresh reviewer, cold reading)
- P2 (fixed): a history persistence failure (disk full, permission, Windows
  lock) no longer discards the verdict the CLI just produced — the append is a
  side-channel audit and is best-effort. (Reads already skipped corrupt lines.)
- P2 (fixed): the install hint distinguishes a missing CLI (spawn
  ENOENT/EACCES) from a CLI that ran but did not pass (model mismatch / report
  error / timeout), so it no longer claims the CLI is missing when it is not.
- P2 (fixed): supplying both apiKey and apiKeyEnv now returns 400
  `conflicting_key_fields` instead of silently ignoring the named variable.
- P2 (fixed, pre-existing): strict typecheck failures in the SSRF helpers
  (possibly-undefined capture groups / octets) are resolved; `isPrivateIPv4`
  also rejects non-finite and non-4-part input.
- Suite: 119 vitest (12 files); typecheck, verify (0 FAIL/WARN/INFO) and pack
  (9 files) all pass.

## v0.1.8 — Round-11 independent clean review (fresh reviewer, cold reading)
- P2-1 (verified present): the spawn 'error' path already calls finish (a
  spawn-stage failure cannot hang the promise).
- P2-2 (fixed): the timeout timer guards the close/timer race — a child that
  already exited (exitCode set) is not marked timed out.
- P2-4 (fixed): redact now covers `Authorization: Basic <base64>` credentials.
- P2-6 (fixed): the SSRF guard blocks multicast (224.0.0.0/4), reserved
  (240.0.0.0/4), and benchmarking (198.18.0.0/15) ranges.
- Verified non-issues: integer/hex/octal/short-form IPv4 (2130706433,
  0x7f000001, 0177.0.0.1, 127.1) are normalized to 127.0.0.1 by WHATWG URL
  before the guard; the v4Hex branch uses radix 16; Windows process.env is
  case-insensitive.
- Suite: 116 vitest (12 files).

## v0.1.7 — Round-10 independent clean review (fresh reviewer, cold reading)
- P2-1 (fixed): extracted OutputCapture/TailCapture (deterministic byte/tail
  caps); stdout/stderr truncation flags are returned in the response and
  history; output_truncated fires on any cap, not only on a parse error.
- P2-2 (fixed): firstHextet uses ':' only and the ULA/link-local range check
  requires IPv6, so DNS names (fc00.example.com) are not false-blocked.
- Suite: 114 vitest (12 files).

## v0.1.6 — Round-9 independent clean review (fresh reviewer, cold reading)
- P2-1 (fixed): the SSRF guard now catches deprecated IPv4-compatible IPv6
  (`::127.0.0.1`, `::7f00:1`, `::0a01:0101`) as well as mapped forms, an
  empty hostname, and multiple trailing dots (`localhost..`).
- P2-2 (fixed): a stdout/stderr capture that hit the byte cap is now reported
  (`stdoutTruncated/stderrTruncated`, error code `output_truncated`) rather
  than being silently cut.
- P2-3 (fixed): redaction now covers GitHub (ghp_/gho_/...), AWS (AKIA), and
  a generic high-entropy mixed-case/digit string, in addition to sk-/Bearer.
- Suite: 106 vitest (3 added); verify 0 FAIL/WARN/INFO; pack 9 files.

## v0.1.5 — Round-8 independent clean review (fresh reviewer, cold reading)
- P2-2 (fixed): a `baseUrl` starting with "-" is now rejected, matching the
  `model` rule (CLI flag injection consistency).
- Stated boundaries (documented, not code changes): the SSRF guard is a
  literal host check, not a DNS-resolution defense (a public domain that
  resolves to a private address is out of scope; the child also receives
  `--total-timeout` to bound its own work); the response returns only the
  structured parsed report, not raw free-text stdout, so custom-prefix
  secret forms in CLI output are not echoed; the timeout SIGKILL backstop
  targets the direct child process.
- Suite: 103 vitest (1 added); verify 0 FAIL/WARN/INFO; pack 9 files.

## v0.1.4 — Round-7 independent clean review (fresh reviewer, cold reading)
- P2-1 (fixed): the SSRF guard now normalizes a trailing dot (`localhost.`) and
  blocks a `.localhost` suffix name.
- P2-2 (fixed): a named `apiKeyEnv` that is not set in the environment now
  returns a 400 fail-closed instead of leaving the child with no key.
- Suite: 102 vitest (2 added); verify 0 FAIL/WARN/INFO; pack 9 files.

## v0.1.3 — Round-6 independent clean review (fresh reviewer, cold reading)
- P1-1 (fixed): the SSRF guard now blocks `localhost` by name (and IPv6
  equivalents). WHATWG URL already normalizes decimal/hex/octal/short IPv4
  encodings (e.g. `2130706433`, `0x7f000001`, `127.1`) to dotted form before the
  guard runs, so those are caught; a domain that resolves to a private address
  still requires DNS and remains the CLI's responsibility (documented).
- P2-1 (fixed): link-local coverage is now the full `fe80::/10` (fe80–febf),
  the hex form of IPv4-mapped IPv6 (`::ffff:7f00:1`) is decoded, and an invalid
  IP fails closed instead of being treated as public.
- P2-2 (fixed): a spawn failure (ENOENT/EACCES) keeps its code as
  `spawn_<code>` (e.g. `spawn_enoent`) so "command missing" is distinguishable
  from "the CLI ran but produced no report"; fail-closed behavior is unchanged.
- P2-3 (fixed): a baseUrl with embedded credentials (userinfo) is rejected with
  400, so they cannot be passed as the `--base-url` argv value.
- P2-5 (fixed): spawn is explicitly `shell: false`.
- New tests: localhost/range/hex-mapped, route-level userinfo and localhost
  rejection, spawn ENOENT. Suite: 95 -> 100 across 11 files. verify still
  0 FAIL/WARN/INFO; pack still 9 files.

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
