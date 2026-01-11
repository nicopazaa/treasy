# AGENTS.md — Universal working agreements for Codex (repo-agnostic)

## Operating principles
- Be deterministic and precise. Do not guess. If something is unknown, mark it as UNKNOWN and state how to verify.
- Follow the user’s instructions exactly. If instructions conflict, call it out and propose the smallest safe resolution.
- Make the smallest change that satisfies the request. Avoid unrelated refactors.
- Keep changes readable, modular, and consistent with the existing code style.

## Safety & scope control
- Do not change public APIs, data formats, persistence keys, migrations, auth flows, or build tooling unless explicitly requested.
- Do not add new dependencies without explicit user approval.
- If a change is high-risk, implement behind a feature flag or provide a rollback path when feasible.

## Truth files (single source of truth)
If the repo contains any of these files, treat them as authoritative:
- docs/AI_HANDOFF.md
- PROJECT_CONTEXT.md
- docs/ARCHITECTURE.md
- docs/DECISIONS.md
- docs/ROADMAP.md
- docs/STATUS.md

Precedence (if they conflict):
1) User request in the current task
2) docs/DECISIONS.md (chosen patterns/tradeoffs)
3) docs/ARCHITECTURE.md + PROJECT_CONTEXT.md (structure + constraints)
4) docs/ROADMAP.md + docs/STATUS.md (priorities + in-progress)
5) Everything else (non-authoritative)

Rules:
- If behavior/architecture changes, update the relevant truth files in the same PR/commit.
- If the request modifies decisions (tradeoffs, chosen patterns), add an entry to docs/DECISIONS.md.
- If the request completes or creates work items, update docs/ROADMAP.md and/or docs/STATUS.md.
- Do not reformat markdown files unless content changes require it (avoid noisy diffs).

## Implementation workflow (always)
1) Inventory: locate the relevant files and confirm assumptions with code references (paths).
2) Plan: outline a short plan (3–8 bullets) before editing.
3) Edit: implement with minimal blast radius and defensive programming.
4) Verify: run existing repo scripts (do not invent commands).
5) Report: provide a clear completion report.

## Verification rules
- Prefer package scripts (npm/yarn/pnpm scripts, make targets, etc.).
- Run typecheck/lint/tests/build only if they exist in the repo.
- If verification cannot be run (missing deps/tooling), state exactly why and what would be needed.

## Output format (end of every task)
Return:
1) Summary (what changed + why)
2) Files changed (list)
3) Commands run + results (pass/fail)
4) Notes (risks, migrations, flags, UNKNOWNs)

## Code quality baseline
- Handle null/undefined and edge cases.
- Keep functions small and cohesive.
- Prefer pure functions for domain logic.
- Avoid duplication; reuse existing utilities/components.
- Add/adjust tests when the repo has a testing setup and the change is non-trivial.
