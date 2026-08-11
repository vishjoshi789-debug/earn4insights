# Preview / test environment setup

**Why this exists:** production is currently the only environment, and it runs on **LIVE Razorpay
keys** (`rzp_live_…`). No payment flow can be exercised without charging a real card, which is why
the payment-ledger fix cannot be rehearsed and the "no brand pays until the ledger is fixed" gate
has to be a promise rather than a test.

This document covers the dashboard steps. The code side (migration 036, `/api/admin/env-check`) is
already shipped.

> ⚠️ **The default is wrong.** Vercel environment variables apply to **All Environments** unless
> you scope them. A preview deployment therefore inherits production's database, blob store and
> live payment keys *by default*. Every variable below is listed because leaving it unscoped
> causes a specific, real problem — not for completeness.

---

## 1. Database — a Neon branch, not production

Neon → project → **Branches** → **New branch** from `main`, name it `preview`.
Copy its pooled connection string.

Preview must **never** share the production database. A preview deployment runs unreleased code
against whatever DB it is given; a bad migration or a stray delete would hit real user data.

---

## 2. Razorpay test keys

Razorpay dashboard → toggle to **Test Mode** → Settings → API Keys → generate.
You want `rzp_test_…` for both the key id and the publishable id, plus a **separate test webhook
secret** (Test Mode webhooks are configured independently of Live Mode).

Test card for the rehearsal: `4111 1111 1111 1111`, any future expiry, any CVV.

---

## 3. Vercel environment variables

Vercel → Project → Settings → Environment Variables. For each row: set the Preview value with
**only the Preview checkbox ticked**, and re-save the production value with **only Production
ticked** if it is currently "All Environments".

### Must differ — these cost money or corrupt data if shared

| Variable | Preview value | What goes wrong if shared |
|---|---|---|
| `POSTGRES_URL` | Neon `preview` branch | Preview writes to real user data |
| `DATABASE_URL` | same as above | as above |
| `RAZORPAY_KEY_ID` | `rzp_test_…` | **a test payment charges a real card** |
| `RAZORPAY_KEY_SECRET` | test secret | signature verification fails against test orders |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `rzp_test_…` | checkout widget opens in Live mode |
| `RAZORPAY_WEBHOOK_SECRET` | test webhook secret | live webhooks hit preview, or preview's are rejected |
| `BLOB_READ_WRITE_TOKEN` | separate Blob store | preview uploads land in the production blob store, mixing test media into the set that was rotated after the 2026-07-31 incident |
| `AUTH_SECRET` | new random value | a session minted on preview is valid on production |
| `ADMIN_API_KEY` | new random value | preview's admin routes accept the production key |
| `CRON_SECRET` | new random value | same |

### Must be UNSET on Preview — not set to a value

| Variable | Why |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Leave blank so `VERCEL_URL` wins. Otherwise `getAppBaseUrl()` returns production and **verification links generated on preview point at production**, so the token is consumed against the wrong deployment and preview looks broken. |
| `AUTH_URL` | Same reason — plus NextAuth would mint cookies for the wrong domain. |

### Consider unsetting on Preview

| Variable | Why |
|---|---|
| `RESEND_API_KEY` | With it set, preview sends **real email to real addresses**. Unset it and sends fail loudly (recorded as `failed` in `email_deliveries`) rather than surprising someone. Set it only while specifically testing email. |
| `TWILIO_*` | Real SMS / WhatsApp to real numbers. |

### Safe to share

`OPENAI_API_KEY` (cost only), `UPSTASH_*` (rate limiting; separate keyspace is nicer but not
required), `PUSHER_*` (a shared app means preview and production events interleave on the same
channels — acceptable for testing, separate app is cleaner).

`CURRENT_ENCRYPTION_KEY_ID` + `ENCRYPTION_KEY_v1` **must be present** on preview or anything
touching TOTP/bank details throws. They can be different values, since preview has its own database
and therefore no production ciphertext to read.

---

## 4. Build the preview database

Deploy a preview (any branch push, or Vercel → Deployments → Redeploy a branch), then run the
migrations **against the preview deployment's URL**, in numeric order, with the **preview**
`ADMIN_API_KEY`:

```bash
BASE="https://<your-preview-deployment>.vercel.app"
for n in 002 003 004 005 006 007 008 009 010 011 012 013 014 015 016 017 018 019 020 \
         021 022 023 024 026 027 028 029 030 031 032 033 034 035 036; do
  echo "── $n ──"
  curl -s -X POST "$BASE/api/admin/run-migration-$n" -H "x-api-key: $PREVIEW_ADMIN_API_KEY"
  echo
done
```

⚠️ **Run 036.** `brand_subscriptions` was created historically by `drizzle push` and existed in no
numbered migration until 036, so a database built from the routes alone would be missing it —
`getBrandSubscription` is called on two live brand feedback pages. 036 also re-asserts
`UNIQUE(user_id, event_type)` on `notification_preferences`, which `upsertPreference` depends on.

---

## 5. Verify — do not assume

```bash
curl -s "$BASE/api/admin/env-check" -H "x-api-key: $PREVIEW_ADMIN_API_KEY" | jq
```

Expect `"ok": true` and an empty `warnings` array. The route reports **presence and mode only** —
never a secret value. It fails you loudly on the cases that matter:

- LIVE Razorpay keys on a non-production deployment
- server/client Razorpay key **mode mismatch**
- a database host that doesn't look like a branch
- a computed base URL still pointing at `earn4insights.com`
- `RESEND_WEBHOOK_SECRET` missing

Re-run it after **every** env change: a Vercel env edit only binds on a **fresh deploy after the
save** (the `CSRF_ENFORCE` gotcha — it took several attempts to persist).

---

## 6. Payment rehearsal (the reason for all of this)

Only once `env-check` is clean:

1. Sign up a brand on preview, create a product and a campaign
2. Pay with `4111 1111 1111 1111`
3. Confirm a `razorpay_orders` row reaches `paid`
4. **Confirm whether a `campaign_payments` row exists** ← this is the ledger gap; today it will not
5. Trigger a refund and confirm the sync behaves

Steps 4–5 are the scoping input for the ledger fix, including the campaign-level vs
milestone-level granularity decision and the `escrowForMilestone` reconciliation.

---

## 7. Local development

`AUTH_URL` in `.env.local` pointed at `https://earn4insights.com`, so NextAuth minted `Secure`
cookies that a browser will not send over plain-HTTP localhost — **login was impossible locally**,
which is the root cause of most of the "not verified in a browser" backlog.

Now set to `http://localhost:9002`. To revert: `AUTH_URL="https://earn4insights.com"`.

> 🔴 **`.env.local` still points at the PRODUCTION database, with LIVE Razorpay keys and the live
> Resend key.** Local dev is not a sandbox — it is production with a different frontend. Now that
> login works, a click in local dev can charge a real card, email a real person, or delete real
> data.
>
> **Point `.env.local` at the preview Neon branch and the `rzp_test_` keys as soon as they exist.**
> Until then, treat local dev as read-only.
