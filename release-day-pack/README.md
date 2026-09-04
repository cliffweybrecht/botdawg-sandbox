# Release Day Pack

A lean set of templates and checklists for shipping software cleanly.

**Price:** $1 digital product  
**Format:** Plain Markdown — open in any editor, paste into GitHub, Slack, or Teams.

## What's inside

| Path | Purpose |
|------|---------|
| `templates/release-notes.md` | GitHub Release body (Features / Fixes / Breaking / Other) |
| `templates/pull-request.md` | PR description with conventional-commit summary line |
| `templates/deploy-announce.md` | Short "we shipped" paste for Slack/Teams |
| `templates/hotfix.md` | Hotfix communication checklist |
| `checklists/ship-day.md` | Pre-ship and post-ship checklist |
| `LICENSE.txt` | Single-purchaser license (no resale of this pack) |
| `REVENUE.md` | Stub ledger for tracking sales |

## How to use

1. Copy the pack into your repo or keep it beside your projects.
2. Before a release: walk `checklists/ship-day.md` (pre-ship section).
3. Open a PR with `templates/pull-request.md` (or paste sections into your existing PR template).
4. Tag the release and fill `templates/release-notes.md` as the GitHub Release body.
5. After deploy: send `templates/deploy-announce.md` to your channel; finish the post-ship checklist.
6. If something breaks in production: use `templates/hotfix.md` so comms stay consistent.

## Conventions

- Prefer [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `BREAKING CHANGE:`).
- Keep release notes scannable: one bullet per user-visible change.
- Announce only after the deploy is confirmed healthy (or clearly mark as rolling).

## What this is not

- Not a CI/CD tool, not payment or billing code, and not legal advice beyond the pack license.
- No sample secrets, API keys, or environment files.

Ship calmly. Ship often.
