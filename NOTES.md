# DSH Standard v2.0.0 compliance notes (pre-publish)

Reference: STANDARD.en.md (lanbaolu/dsh-plugin-standard, adopted 2026-08-19).
This list marks what is DONE vs PENDING; nothing pending is claimed as complete.

## Done in this copy
- [x] package.json `dsh.bundle.patch` points at `./cordis.patch.yml`; bundle type declared.
- [x] Thin shell: no verification logic reimplemented; delegates to local CLI.
- [x] Key never in argv, never persisted, never in report; stderr/errors redacted.
- [x] History append-only, host-only (userinfo/path/query stripped, case-normalized).
- [x] Timeout cap (SIGKILL) and stdout byte ceiling in probe-runner.
- [x] Pure-logic unit tests + pass/suspicious/error stubs; `npm run test` green.
      Historical counts: 59 at v3, 61 at v5 (mutation check); **84 on 2026-10-22**
      after the security hardening round (env whitelist, command gate, body cap/shape).
- [x] MIT license; no official-implication naming; no fabricated stats.
- [x] P1-1: official `verify-plugin` checker vendored at `scripts/verify-plugin.mjs`
      (provenance header records source URL + commit); `verify`/`pack` scripts added;
      `npm run verify` exits 0 (0 FAIL; 2 non-blocking WARNs documented in the fix report).
- [x] P2-1 (§3.6.4): `buildChildEnv` uses a minimal whitelist (Unix PATH/HOME/TMPDIR;
      Windows Path/SystemRoot/SystemDrive/ComSpec/PATHEXT/USERPROFILE/TEMP/TMP/
      LOCALAPPDATA/APPDATA) plus the injected probe key var; parent secrets are dropped.
- [x] P2-2 (§3.6.2): custom `command` is labeled "自定义可执行路径=代码执行面" in the UI;
      a one-time in-process confirmation gate precedes the first custom spawn.
- [x] P2-3 (§3.3.2): POST body capped at 256KB (413), strict JSON shape + field
      whitelist + type validation (400); unknown fields rejected.
- [x] P3: `lib/client.d.ts` emitted and wired into `exports["./client"].types`;
      `engines.node >=22`; `files` trimmed to `lib` + `cordis.patch.yml`;
      ref-based submit mutex; in-process promise-chain lock on history appends.

## PENDING before any real release (not done here)
- [ ] Publish kernel to PyPI first; replace the `command` local-checkout path default.
- [ ] Verify against a live dsh-tui 0.16.x host interface (**no runtime live test on
      machine**; this remains outstanding).
- [ ] Add a non-prerelease GitHub Release + `dsh-plugin` topic at publish time.

## Honest scope notes
- **Real dsh-tui 0.16.x host live testing has NOT been done.** The static gate
  (`verify-plugin`) covers manifest/patch/exports consistency only; §3/§4/§5
  lifecycle/HTTP/persistence/XSS rules still need human review per Appendix B.
- **Host/Origin/loopback enforcement is the host channel's responsibility**, not
  this module's: the plugin registers routes on the authenticated connection
  channel and does not re-implement CSRF/Origin checks itself.
- **npm name `dsh-model-probe` is taken** by another, deprecated package; this
  project does not publish to npm (see README.md / README.en.md disclosure).

## Mutation check (v5, historical)
- Bypassing `hostOnly()` in `normalizeVerifyReport` (return raw URL) -> the two new
  endpoint-host tests fail red; reverted; full suite green (61 at that time).
