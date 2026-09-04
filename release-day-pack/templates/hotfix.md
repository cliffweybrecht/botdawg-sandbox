# Hotfix communication checklist

Use when production is broken or degraded and a fast patch is required.

## Triage (first 5–10 minutes)

- [ ] Confirm impact: who / what / how bad (severity)
- [ ] Assign: incident lead, fixer, communicator
- [ ] Open incident channel / thread; post first status
- [ ] Freeze unrelated deploys if needed

## First status (paste)

```
HOTFIX in progress — [service]
Impact: [who/what]
Status: investigating / patching / verifying
ETA for next update: [time]
Owner: @[name]
```

## Fix path

- [ ] Reproduce or isolate root cause (enough to patch safely)
- [ ] Branch from production tag / main as agreed
- [ ] Minimal change; tests for the failure mode
- [ ] PR titled `fix!: …` or `fix: …` + link to incident
- [ ] Extra reviewer if change touches auth, data, or billing
- [ ] Deploy via agreed hotfix path (not "drive-by" prod edits)

## Customer / stakeholder updates

- [ ] Internal: impact, ETA, workaround
- [ ] External (if needed): status page or support template — no blame, no speculation
- [ ] Cadence: update every N minutes until resolved

## Close-out

- [ ] Confirm metrics / error rate back to baseline
- [ ] Announce resolution (reuse deploy-announce, mark as hotfix)
- [ ] Tag release notes under **Fixes** (and **Breaking** if applicable)
- [ ] Schedule postmortem if severity warrants
- [ ] File follow-ups (monitoring, tests, docs)

## Resolution paste

```
RESOLVED — [service] hotfix vX.Y.Z
Impact window: [start–end timezone]
Root cause (brief): [one line]
Fix: [one line + release link]
Follow-ups: [ticket links]
```
