# Ship-day checklist

## Pre-ship

### Code & quality

- [ ] All intended PRs merged; version bump decided (semver)
- [ ] CI green on the release commit
- [ ] Changelog / release notes drafted (`templates/release-notes.md`)
- [ ] Breaking changes documented with upgrade steps
- [ ] Feature flags / migrations reviewed; order of apply known

### Environments & secrets

- [ ] Target env config verified (no new secrets in git)
- [ ] DB migrations tested on a copy or staging
- [ ] Rollback artifact ready (previous image/tag)

### People & timing

- [ ] On-call / owner identified for the deploy window
- [ ] Stakeholders notified of ship window if user-facing
- [ ] Avoid known freeze windows unless hotfix

### Go / no-go

- [ ] Staging (or canary) smoke passed
- [ ] Monitoring dashboards open (errors, latency, business KPIs)
- [ ] Explicit go from owner

## Deploy

- [ ] Tag and publish release (GitHub Release body filled)
- [ ] Deploy via standard pipeline
- [ ] Smoke: health, auth, critical path, one write path
- [ ] Watch metrics for agreed bake time

## Post-ship

- [ ] Paste `templates/deploy-announce.md` to Slack/Teams
- [ ] Confirm no elevated errors / support spike
- [ ] Close ship ticket / mark milestone
- [ ] Note anything for next time in team doc (optional)
- [ ] If issues: follow `templates/hotfix.md`

## Done when

- [ ] Release published, announce sent, bake window clean, owner signed off
