# Authentication Troubleshooting Guide

## Issues Identified

### Problem 1: Google Sign-In Not Working
**Symptom:** Google sign-in button asks for email/password instead of immediately redirecting to Google OAuth

**Root Cause:** Missing Google OAuth credentials in environment variables

**Why This Happens:**
- `.env.local` file doesn't exist locally
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not configured
- When Auth.js can't find Google OAuth credentials, it falls back to credential provider
- Production (Vercel) also likely missing these environment variables

### Problem 2: Email/Password Login Failing
**Symptom:** "Wrong password" errors when trying to sign in

**Root Cause:** Trying to use credentials that don't exist

**Why This Happens:**
- User data is stored in PostgreSQL database
- If you haven't created an account via `/signup` first, credentials won't match
- Database might have old/different password hashes

### Problem 3: Signup Errors
**Symptom:** Errors when creating new account

**Possible Causes:**
1. Database connection issues
2. Validation errors (password too short, terms not accepted)
3. Email already exists
4. Missing environment variables

---

## Solutions

### Solution 1: Set Up Google OAuth (Recommended)

#### Step 1: Create Google OAuth Credentials

1. **Go to Google Cloud Console:**
   https://console.cloud.google.com/apis/credentials

2. **Create OAuth 2.0 Client ID:**
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: Web application
   - Name: "Earn4Insights"
   
3. **Add Authorized Redirect URIs:**
   ```
   http://localhost:3000/api/auth/callback/google
   https://earn4insights.vercel.app/api/auth/callback/google
   ```

4. **Copy Credentials:**
   - Client ID (looks like: `123456789-abc.apps.googleusercontent.com`)
   - Client Secret (looks like: `GOCSPX-abc123...`)

#### Step 2: Add to Local Environment

Create `.env.local` file:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here

# Database (copy from existing .env or Vercel)
DATABASE_URL=your-postgres-connection-string

# Auth Secret (generate with: openssl rand -base64 32)
AUTH_SECRET=your-random-secret-here

# Other env vars...
```

#### Step 3: Add to Vercel

```powershell
# Add to Vercel production environment
vercel env add GOOGLE_CLIENT_ID
# Paste your client ID when prompted

vercel env add GOOGLE_CLIENT_SECRET
# Paste your client secret when prompted

# Redeploy
npx vercel --prod
```

---

### Solution 2: Use Email/Password Auth (If Google OAuth not available)

#### For Testing: Create a Test Account

Run this script to create a test user:

```powershell
node create-test-user.mjs
```

This will create:
- Email: `test@example.com`
- Password: `Test1234!`
- Role: Brand

Then sign in at: https://earn4insights.vercel.app/login

---

### Solution 3: Reset Your Account

If you have an existing account but forgot password:

1. **Check your email in the database:**
   ```sql
   SELECT email, role FROM users WHERE email = 'your-email@gmail.com';
   ```

2. **Reset password manually:**
   Run: `node reset-password.mjs`
   - Enter your email
   - Enter new password
   - Password will be updated

---

## Quick Fix for Testing

**Fastest way to test the system:**

1. **Use the direct signup page:**
   ```
   https://earn4insights.vercel.app/signup
   ```

2. **Fill in ALL fields:**
   - Name: Test User
   - Email: test123@example.com
   - Password: Test1234! (at least 8 characters)
   - Role: Brand or Consumer
   - ✅ Check "Accept Terms of Service"
   - ✅ Check "Accept Privacy Policy"

3. **Click "Create Account"**

4. **If you get errors, check:**
   - Password is at least 8 characters
   - Both checkboxes are checked
   - Email doesn't already exist

---

## Debugging Commands

### Check if .env.local exists:
```powershell
Test-Path .env.local
```

### Check database connection:
```powershell
node test-db-connection.mjs
```

### Check existing users:
```powershell
node list-users.mjs
```

### Create test user:
```powershell
node create-test-user.mjs
```

---

## Common Error Messages

### "Invalid email or password"
- Email doesn't exist in database
- Password doesn't match
- **Fix:** Create account via `/signup` first

### "Email already exists"
- You already have an account
- **Fix:** Use `/login` instead, or reset password

### "Password must be at least 8 characters"
- Password too short
- **Fix:** Use longer password (e.g., `Password123!`)

### "You must accept the Terms of Service"
- Checkbox not checked
- **Fix:** Check both checkboxes before submitting

### "Failed to create account"
- Database connection issue
- **Fix:** Check `DATABASE_URL` in environment variables

---

## Why Google OAuth Is Better

**Advantages:**
- ✅ No password to remember
- ✅ One-click sign in
- ✅ More secure
- ✅ Better user experience
- ✅ No signup form needed

**Current Issue:**
- Missing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Once configured, Google sign-in will work immediately

---

## Next Steps

**Choose ONE:**

### Option A: Set Up Google OAuth (Best for production)
1. Follow "Solution 1" above
2. Add credentials to `.env.local`
3. Add credentials to Vercel
4. Redeploy
5. Test Google sign-in

### Option B: Use Email/Password (Quick testing)
1. Go to `/signup`
2. Create account with email/password
3. Sign in at `/login`
4. Start testing

---

## Files to Check

- [auth.config.ts](src/lib/auth/auth.config.ts) - Auth configuration
- [auth.actions.ts](src/lib/actions/auth.actions.ts) - Sign in/up actions
- [login/page.tsx](src/app/(auth)/login/page.tsx) - Login page
- [signup/page.tsx](src/app/(auth)/signup/page.tsx) - Signup page

---

**Recommendation:** Set up Google OAuth for best experience. For immediate testing, create an account via `/signup`.
