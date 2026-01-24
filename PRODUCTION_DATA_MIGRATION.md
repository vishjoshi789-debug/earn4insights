# Production Data Migration Strategy

## PROBLEM
Vercel deployments have ephemeral filesystems - any data written to JSON files will be LOST on redeploy.

## IMMEDIATE SOLUTION OPTIONS

### Option 1: Vercel KV (Redis) - FASTEST
```bash
npm install @vercel/kv
```

**Pros:**
- Zero config
- Free tier: 256MB
- Fast setup (< 30 min)
- Good for early users

**Setup:**
1. Enable Vercel KV in dashboard
2. Get connection string
3. Update data access layer

### Option 2: Vercel Postgres - RECOMMENDED
```bash
npm install @vercel/postgres
```

**Pros:**
- Proper relational DB
- Free tier: 256MB, 60 hours compute/mo
- Easy to upgrade later
- Better for product data

**Setup:**
1. Enable Vercel Postgres in dashboard
2. Get DATABASE_URL
3. Create schema
4. Migrate data

### Option 3: Supabase - BEST LONG-TERM
```bash
npm install @supabase/supabase-js
```

**Pros:**
- Free tier: 500MB DB, 1GB file storage
- Built-in auth (can replace Auth.js later)
- Real-time features
- File storage included

**Setup:**
1. Create Supabase project
2. Get API keys
3. Create schema
4. Migrate data

## RECOMMENDED PATH FOR YOUR LAUNCH

### Phase 1: LAUNCH WITH VERCEL POSTGRES (This Week)
1. Enable Vercel Postgres
2. Create tables for:
   - users
   - products
   - surveys
   - responses
3. Copy existing JSON data to DB
4. Deploy

### Phase 2: MIGRATE TO SUPABASE (After 100 users)
- More features
- Better scaling
- File storage

## MIGRATION SCRIPT NEEDED

Create `scripts/migrate-to-postgres.ts`:
```typescript
// Read JSON files
// Connect to Postgres
// Insert data
// Verify
```

## BACKWARD COMPATIBILITY

**If you deploy WITHOUT fixing storage:**
- Users can sign up
- Users can create products/surveys
- BUT: Data will be lost on next deploy

**DO NOT launch publicly until storage is fixed.**
