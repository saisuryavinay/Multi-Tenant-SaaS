# Login Failure Fix - Super Admin & Demo Admin

## Problem Identified
The login was failing for all super admin and demo admin accounts because the seed script was using `ON CONFLICT DO NOTHING` clause, which silently fails when:
- Records already exist in the database
- There are any constraint violations
- This prevented the super admin and demo admin users from being created

## Root Cause
In `backend/seeds/run-seeds.js`, the original code used:
```javascript
INSERT INTO users (...) VALUES (...) ON CONFLICT DO NOTHING
```

This is a PostgreSQL idiom that fails silently - if the insert fails due to conflicts, it simply does nothing and continues, leaving the user records uninserted.

## Solution Applied
Replaced all `ON CONFLICT DO NOTHING` patterns with explicit existence checks:

1. **Check if record exists** before attempting insert
2. **Insert only if missing** - using explicit INSERT with RETURNING clause
3. **Proper error handling** - RETURNING ensures we get the ID
4. **Clear logging** - Shows whether records were created or already existed

### Changes Made
- Modified `backend/seeds/run-seeds.js` to use explicit checks for:
  - Super admin user
  - Demo tenant
  - Demo tenant admin user
  - Regular users (user1, user2)
  - Sample projects
  - Sample tasks

## Test Credentials (After Reseeding)

### Super Admin
- **Email**: `superadmin@system.com`
- **Password**: `Admin@123`
- **Login**: No tenant subdomain required

### Demo Tenant Admin  
- **Email**: `admin@demo.com`
- **Password**: `Demo@123`
- **Tenant Subdomain**: `demo`

### Demo Tenant Users
- **User 1**: `user1@demo.com` / `User@123`
- **User 2**: `user2@demo.com` / `User@123`

## How to Apply the Fix

### Option 1: Fresh Database (Recommended)
```bash
# Stop containers
docker-compose down -v

# Remove volume to clear database
# Then restart
docker-compose up
```

### Option 2: Keep Existing Database
If you want to keep existing data, manually delete the admin users first:
```sql
DELETE FROM users WHERE email = 'superadmin@system.com';
DELETE FROM users WHERE email = 'admin@demo.com';
```
Then run:
```bash
npm run seed
```

## Verification
After applying the fix, check the logs for:
```
✓ Super admin created: [id]
✓ Demo tenant created: [id]
✓ Tenant admin created: [id]
✓ User One created: [id]
✓ User Two created: [id]
```

If you see "already exists" messages instead, the users are already in the database and the seed was correctly skipped.
