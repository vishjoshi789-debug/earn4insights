# 🔒 Authentication Issue - Quick Fix Guide

## The Problem

You're experiencing authentication issues:
1. ❌ Google sign-in not working (asks for email/password instead)
2. ❌ "Wrong password" errors
3. ❌ Signup errors

## Root Cause

**Missing Google OAuth credentials:**
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not configured
- Without these, Google sign-in doesn't work
- System falls back to email/password authentication

## Quick Solutions

### Option A: Use Email/Password (Fastest for Testing)

**Just go to the signup page and create an account:**

1. **Visit:** https://earn4insights.vercel.app/signup

2. **Fill in the form:**
   - Name: Your Name
   - Email: your-email@example.com
   - Password: **At least 8 characters** (e.g., `Password123!`)
   - Role: Brand or Consumer
   - ✅ **IMPORTANT:** Check BOTH checkboxes:
     - "I accept the Terms of Service"
     - "I accept the Privacy Policy"

3. **Click "Create Account"**

4. **Then sign in at:** https://earn4insights.vercel.app/login

**Common Mistakes:**
- Password too short (must be 8+ characters)
- Forgot to check the checkboxes
- Email already exists (use a different email or reset password)

---

### Option B: Set Up Google OAuth (Better Long-Term)

#### Step 1: Get Google OAuth Credentials

1. Go to: https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://earn4insights.vercel.app/api/auth/callback/google`
4. Copy Client ID and Client Secret

#### Step 2: Add to Vercel Environment

```powershell
# Add Google OAuth credentials to Vercel
vercel env add GOOGLE_CLIENT_ID
# Paste your Client ID when prompted

vercel env add GOOGLE_CLIENT_SECRET
# Paste your Client Secret when prompted

# Redeploy
npx vercel --prod
```

#### Step 3: Add to Local Environment (Optional)

Create `.env.local`:
```
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here
```

---

## Utility Scripts Created

I've created helper scripts for you:

### 1. List Users
```powershell
node list-users.mjs
```
Shows all users in database

### 2. Create Test User
```powershell
node create-test-user.mjs
```
Creates test account:
- Email: test@example.com
- Password: Test1234!
- Role: brand

### 3. Reset Password
```powershell
node reset-password.mjs
```
Resets password for existing user

---

## For Immediate Testing

**DO THIS NOW:**

1. **Go to:** https://earn4insights.vercel.app/signup

2. **Fill form with:**
   - Name: Test User
   - Email: testuser123@example.com
   - Password: Test1234567!
   - Role: Brand
   - Check BOTH boxes

3. **Create account**

4. **Then test Phase 4:**
   - View products
   - Complete onboarding
   - Run test scripts

---

## Why This Happened

The site was previously working with Google OAuth, but:
- Google OAuth credentials expired or were removed
- Environment variables not synced to Vercel
- `.env.local` file doesn't exist locally

---

## Full Documentation

See [AUTH_TROUBLESHOOTING.md](AUTH_TROUBLESHOOTING.md) for complete details.

---

**Recommendation:** Use Option A (email/password signup) right now to continue testing Phase 4. Set up Google OAuth later for better UX.
