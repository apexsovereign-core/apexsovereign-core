# Task 5 — evidence export

Local evidence only. No commit, push, deployment, credential rotation, or
history rewrite of the active repository was performed.

## Required logs

| File | Command | Result |
| --- | --- | --- |
| `git-diff-stat-main-head.txt` | `git diff --stat main...HEAD` | Exit 0 |
| `npm-run-typecheck.txt` | `npm run typecheck` | Exit 0 |
| `npm-run-build.txt` | `npm run build` | Exit 0 (chunk-size warning only) |
| `npx-playwright-test.txt` | `npx playwright test` | 7 passed, exit 0 |

## Supporting evidence

| File | Contents |
| --- | --- |
| `hosting-table.md` | Updated Task 0 hosting and configuration inventory |
| `live-headers.txt` | Raw headers for the six live paths |
| `gitleaks-summary.md` | History and working-tree findings, redaction check, classification |
| `gitleaks-working-tree.json` | Redacted working-tree report |
| `gitleaks-working-tree.toml` | Scan scope exclusions |
| `hardening-summary.md` | Implementation details, verification table, blocked items |
| `pytest.txt` | Backend suite: 59 passed |
| `pytest-raw-body.txt` | Focused raw-body webhook tests: 4 passed |
| `bun-install.txt` | Bun install that synchronized `bun.lock` |
| `bun-install-frozen.txt` | Frozen lockfile check: no changes |
| `bun-version.txt` | Bun 1.4.4 |
| `purge-script-prepare.txt` | Mirror rewrite completed; `.env.production` verified absent |
| `purge-script-gate.txt` | `--push` refused without rotation confirmation |
| `purge-script-help.txt` | Script usage and syntax check context |
| `git-diff-stat-working-tree.txt` | Uncommitted working-tree diff summary |
| `git-status-short.txt` | Working-tree status |

## Exit-code files

Each `*.exit.txt` records the exit code printed by the corresponding command.
The Playwright, typecheck, build, pytest, and frozen-lockfile checks all report
exit 0.

## Architecture Lock (2026-10-29)

See `architecture-lock-summary.md` for the Vercel-primary routing lock,
PayPal sandbox-only lock, gated history purge (76→0 in the prepared mirror),
Gitleaks re-scans, and Task 2 verification results
(`final-verification.log`, `gitleaks-purged-mirror.json`,
`gitleaks-working-tree-post-lock.json`).
