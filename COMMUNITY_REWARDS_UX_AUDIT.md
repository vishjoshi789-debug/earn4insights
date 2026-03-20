# Community + Rewards UX Audit

Last updated: March 20, 2026

## Scope

Audit target:

- `/dashboard/community`
- `/dashboard/community/[postId]`
- `/dashboard/rewards`
- `/dashboard/payouts`

Method:

- Live deployment route verification on `www.earn4insights.com`
- Code-level UX review of the production-backed community, rewards, and payouts surfaces

## Issues Found

### 1. Community search was noisy and stale

Problem:

- The list fetched on every keystroke.
- Pressing Enter reset the page number but immediately reused the old page in the same call path.

Fix applied:

- Split the draft search input from the committed search query.
- Added explicit Search and Clear actions.
- Kept pagination and filters in sync.

### 2. Key actions had weak feedback

Problem:

- Several actions either failed silently or used browser `alert` dialogs.

Fix applied:

- Added `sonner` toast feedback for create post, reply, poll vote, reward redeem, payout request, and payout processing.
- Added retry cards for load failures.

### 3. Polls allowed avoidable repeat-click attempts

Problem:

- The backend correctly blocked duplicate votes, but the UI did not clearly reflect the user’s existing vote.

Fix applied:

- The post detail API now returns the current user’s poll choice.
- The poll UI now marks `Your vote`, disables repeat voting, and explains that polls allow one vote per user.

### 4. Empty and loading states were too thin

Problem:

- Rewards, payouts, and community pages did not consistently explain what to do when lists were empty or requests failed.

Fix applied:

- Added clearer empty-state copy for filtered community feeds, reward catalog, challenges, recent activity, and payout lists.
- Added retry affordances where data fetches can fail.

### 5. Community post deletion left orphaned related rows

Problem:

- Deleting a post removed the thread and direct reactions, but poll votes and reply-level reactions could remain orphaned.

Fix applied:

- The delete handler now removes poll votes and reply reactions before deleting replies and the post.

### 6. Community search only matched titles

Problem:

- Users could not find threads by text in the body content.

Fix applied:

- Search now matches both post titles and post bodies.

## Residual Recommendations

- Add authenticated browser automation for the full community and rewards flows once a safe production or staging test account strategy exists.
- Add seeded challenge fixtures for deterministic challenge-completion testing.
- Consider a brand moderation surface for pinning and locking threads if community operations expand.