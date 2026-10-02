---
status: v0.1 built and checked locally; not published, repository still private
sponsor_action: decide on the two gates - make the GitHub repository public, and publish 0.1.0 to npm
kill_review: none scheduled; proposed for the Sponsor to confirm - review usage 8 weeks after the npm publish
success_metric: correct plans for 5 real Angular app fixtures, 2 verified by hand, under 30 s with a warm cache (v0.1 - met locally)
---

# State

## Goal
Running `npx ng-upgrade-planner` in an Angular repo prints a hop-by-hop upgrade plan (for example 14 to 22):
for each hop the official update steps, the newest compatible version of every Angular-dependent third-party
library, blockers (libraries with no compatible release) and an effort estimate.

Why now: Angular 20 leaves LTS on 28 Nov 2026 and v2 to v19 are unsupported; `ng update` moves one major at a
time and checks peers only for the current step.

## Current state (v0.1, 2026-10-02)

Done:
- CLI with terminal summary, Markdown report and single-file HTML report; reads npm, pnpm and yarn (classic and
  berry) lockfiles; npm registry client with cache, rate limiting and offline mode.
- Five real open-source fixtures (Angular 11, 13, 15, 16 and 17; npm, pnpm and yarn lockfiles) with recorded
  registry data and snapshot tests of their plans. Sources and licences are in each `SOURCE.md`.
- Two plans verified line by line: `docs/verification/` (jira-clone-angular 11 to 22, yunikorn-web 16 to 22).
  The check was done by the development agent with a separate checker script, not yet by a person.
- Warm cache: each fixture plans in about 0.3 s (`npm run bench:warm`, Node.js 24 on Windows); the limit is 30 s.
- README, CONTRIBUTING, LICENSE (MIT), CHANGELOG, GitHub Actions CI (Node.js 20 and 22), and a package that
  `npm run check:pack` confirms holds only the README, licence, changelog, `package.json` and `dist/`.
- `npm publish` is blocked by `prepublishOnly` until the Sponsor approves.

Confirmed on GitHub: the CI workflow passed on Node.js 20 and 22 (2026-10-02, commit 9348136).

Not verified yet:
- A person has not yet reviewed the two verified plans.
- Effort points are not calibrated against real upgrades.

## Roadmap
- v0.1: the CLI described above, fixtures, reports, open-source docs and CI. Not published.
- v0.2: scan for APIs removed in each hop; an Agent Skill (open SKILL.md format) that executes the plan one hop at a time.
- v1: npm publish and an article written by the Sponsor.

## Sponsor gates
- Making the GitHub repo public.
- Publishing to npm.
