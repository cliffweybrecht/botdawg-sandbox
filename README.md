# Shipkit

A small developer kit for shipping GitHub releases faster.

**Buy ($5 one-time):** https://cliffstone32.gumroad.com/l/vwnmtw

Open `notes.html` locally after purchase (or from this branch while testing).

## What you get

- notes.html: offline single-file app. Paste titles, group them, copy markdown.
- templates: PR and release markdown you can drop into a repo.
- release-notes.yml: comments a changelog skeleton from manual run inputs.
- grouping library plus tests.

Commercial use is granted to the purchaser (see LICENSE.txt).
You may use this in repos you maintain. You may not resell the kit itself.

## Use notes.html (local demo)

1. Open notes.html in a browser (file:// is fine). No build step, no server.
2. Paste merged PR titles, one per line. Prefixes like feat/fix are optional.
3. Groups into Features, Fixes, Breaking, Other.
4. Copy GitHub-flavored markdown into a Release body or templates/release.md.
5. Version, intro, and last paste persist in localStorage.

## Copy files into a repo

1. Copy the workflow yaml into the target repository at the same relative path.
2. Copy templates/pull_request.md to the repo pull request template path.
3. Keep templates/release.md as a starting Release body.
4. Run the Release notes skeleton workflow. Fill version and pr_number.

No extra secrets. No paid APIs.

## Tests

Run the package test script (`npm test` / `node --test`).
Keep notes.html grouping rules aligned with lib/group.mjs.
