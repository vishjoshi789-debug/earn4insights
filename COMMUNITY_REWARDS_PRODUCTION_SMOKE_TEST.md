# Community + Rewards Production Smoke Test

Last updated: March 20, 2026

## Goal

Use this checklist to validate the live community, rewards, and payouts flows with one consumer account and one brand account after each production deploy.

## Accounts Needed

- Consumer account with dashboard access
- Brand account with dashboard access
- Optional second consumer account if you want to verify upvote-earned points without mixing roles

## Preconditions

- Production is serving the latest deploy from `main`
- The rewards catalog is seeded and active
- Challenges are active if you want to verify challenge progression
- The consumer account starts with at least 500 points if you want to test payouts

## Route Availability Checks

Run these unauthenticated probes first. Expected result is `401 Unauthorized`, not `404`:

```powershell
curl.exe -I https://www.earn4insights.com/api/user/points
curl.exe -I https://www.earn4insights.com/api/rewards
curl.exe -I https://www.earn4insights.com/api/challenges
curl.exe -I https://www.earn4insights.com/api/payouts
```

Expected page-route behavior:

```powershell
curl.exe -I https://www.earn4insights.com/dashboard/community/test-post-id
```

Expected result: `307` redirect to sign-in with `X-Matched-Path: /dashboard/community/[postId]`.

## Consumer Flow

### Community

1. Sign in as the consumer account.
2. Open `/dashboard/community`.
3. Verify the list loads without errors.
4. Search for an existing keyword and confirm results change only after pressing Enter or clicking Search.
5. Clear filters and confirm the default feed returns.
6. Create a standard discussion post.
7. Confirm you land on the thread detail page for the new post.
8. Add a reply to the thread.
9. If a second account is available, upvote the post or reply from that account.
10. Return to `/dashboard/rewards` and verify recent activity includes the community post, reply, and any upvote-earned points.

### Polls

1. Create a poll with at least two options.
2. Vote on one option.
3. Confirm the selected option shows `Your vote` and the poll no longer accepts a second vote.
4. Refresh the page and confirm the vote state persists.

### Rewards

1. Open `/dashboard/rewards`.
2. Verify current points, lifetime points, challenge progress, and recent activity render.
3. Redeem one reward the account can afford.
4. Confirm the point balance decreases and a success toast appears.
5. Confirm recent activity shows the redemption transaction.

### Payouts

1. Open `/dashboard/payouts`.
2. Verify current points and cash-out value render.
3. Enter fewer than 500 points and confirm the action is blocked.
4. Enter a valid whole-number amount of at least 500 points.
5. Submit the payout request.
6. Confirm the balance decreases immediately and the request appears as `Pending`.

## Brand Flow

### Community

1. Sign in as the brand account.
2. Open `/dashboard/community`.
3. Open the create-post dialog.
4. Confirm `Announcement` and `AMA` are available in the type selector.
5. Create one announcement or AMA.
6. Confirm you land on the new thread detail page.

### Payout Review

1. Open `/dashboard/payouts`.
2. Confirm pending consumer payout requests are visible.
3. Approve one pending request and confirm it leaves the pending state.
4. Create another pending request from the consumer account.
5. Deny that request from the brand account.
6. Return to the consumer rewards or payouts view and confirm the denied payout refunded points.

## Expected Database Effects

- `community_posts` row added for each created thread
- `community_replies` row added for each reply
- `community_poll_votes` row added once per poll voter
- `user_points.total_points` updated after earn, redeem, payout, and refund events
- `point_transactions` row created for each earn, spend, and refund event
- `reward_redemptions` row created for each redemption
- `payout_requests` row created and later updated to `approved` or `denied`

## Pass Criteria

- No community, rewards, or payouts pages render a blank state due to load failure
- No action depends on browser `alert` dialogs for user feedback
- All successful mutations show visible success feedback
- All invalid actions show visible error feedback
- Polls enforce one vote per user
- Brand-only actions remain unavailable to consumer accounts

## Known Manual Gaps

- Challenge bonus completion still needs a dedicated production run with accounts near each threshold
- Upvote-earned points require a second authenticated account to validate cleanly
- Payout settlement beyond status updates depends on your real payout operations process