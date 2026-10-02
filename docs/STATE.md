---
status: v0.1 in development
sponsor_action: none yet
kill_review: none scheduled
success_metric: correct plans for 5 real Angular app fixtures, 2 verified by hand, under 30 s with a warm cache
---

# State

## Goal
Running `npx ng-upgrade-planner` in an Angular repo prints a hop-by-hop upgrade plan (for example 14 to 22):
for each hop the official update steps, the newest compatible version of every Angular-dependent third-party
library, blockers (libraries with no compatible release) and an effort estimate.

Why now: Angular 20 leaves LTS on 28 Nov 2026 and v2 to v19 are unsupported; `ng update` moves one major at a
time and checks peers only for the current step.

## Roadmap
- v0.1: the CLI described above, fixtures, reports, open-source docs and CI. Not published.
- v0.2: scan for APIs removed in each hop; an Agent Skill (open SKILL.md format) that executes the plan one hop at a time.
- v1: npm publish and an article written by the Sponsor.

## Sponsor gates
- Making the GitHub repo public.
- Publishing to npm.
