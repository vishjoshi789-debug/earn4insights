Project rules (MANDATORY):

Framework & Architecture
- This is a Next.js App Router project.
- Follow App Router conventions strictly.
- Do NOT convert Server Components to Client Components unless explicitly asked.
- Do NOT introduce 'use client' unless required.
- Do NOT change routing structure or folder hierarchy.

Behavior & Safety
- Preserve existing behavior unless explicitly instructed otherwise.
- Never remove or break working features.
- Prefer minimal, incremental changes.
- If a change could affect multiple flows, ASK before proceeding.
- Do NOT refactor unrelated code.

Data & State
- Treat persisted data as backward-compatible.
- Never assume optional data exists unless verified.
- Ensure default initialization for new fields.
- Avoid breaking existing stored data or JSON structures.

TypeScript & Quality
- TypeScript strict mode must remain satisfied.
- Do NOT introduce `any` unless explicitly approved.
- Prefer explicit types and safe guards.
- Do NOT suppress errors with ts-ignore.

Editing Rules
- Modify only files explicitly mentioned in the task.
- Do NOT explore or edit additional files unless requested.
- Show diffs for all changes.
- Apply changes only after planning is complete (if planning is requested).

AI Behavior
- If instructions are ambiguous, ask clarifying questions.
- If task scope is unclear, stop and ask.
- Do NOT auto-escalate scope.
