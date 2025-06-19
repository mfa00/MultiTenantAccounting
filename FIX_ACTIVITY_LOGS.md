# Fix for Missing activity_logs Table

## Problem
The Global Administration page is showing errors because the `activity_logs` table is missing from the database:

```
Error: relation "activity_logs" does not exist
```

This table is needed for:
- System statistics (activity counts)
- Activity logs display
- User action tracking

## Solution

I've created two solutions to fix this issue:

### Option 1: Quick Fix Script (Recommended)

Run this command in your SSH session where npm is available:

```bash
npm run fix-activity-logs
```

This will:
- ✅ Create the missing `activity_logs` table
- ✅ Add proper indexes for performance
- ✅ Insert sample activity data for testing
- ✅ Verify the table was created successfully

### Option 2: Manual SQL Fix

If you prefer to run SQL directly, execute the contents of `scripts/fix-activity-logs.sql` in your database.

## Temporary Backend Fix

I've also made the API more resilient by:

1. **Stats API**: Now handles missing activity_logs table gracefully
2. **Activity API**: Returns empty array instead of crashing
3. **Error Handling**: Warns in console but doesn't break the page

This means the Global Administration page will work even before you fix the table, but you should still run the fix for full functionality.

## After Running the Fix

Once you run `npm run fix-activity-logs`, you should see:

✅ **No more errors** in the server console  
✅ **System Statistics** showing correct data  
✅ **Activity Logs tab** displaying sample activities  
✅ **Real-time updates** working properly  

## Root Cause

The `activity_logs` table was defined in the migration file but wasn't created during the initial database setup. This fix ensures the table exists and is properly configured.

## Files Created/Modified

- `scripts/fix-activity-logs.sql` - SQL to create the missing table
- `scripts/fix-activity-logs.ts` - Node.js script to execute the fix
- `server/api/global-admin.ts` - Made more resilient to missing tables
- `package.json` - Added `fix-activity-logs` script

## Next Steps

1. Run `npm run fix-activity-logs` in your SSH session
2. Refresh the Global Administration page
3. Verify that all tabs load without errors
4. Test creating/editing companies and users to ensure real-time updates work 