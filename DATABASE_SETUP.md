# Database Setup Instructions

## Issue
You're seeing errors like "Failed to load resource: the server responded with a status of 400" or "Error fetching tasks" because the new database tables haven't been created yet.

## Solution
Follow these steps to set up the database tables:

### Step 1: Access Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the **SQL Editor** tab

### Step 2: Run the Setup Script
1. Copy the contents of `setup_database.sql` file
2. Paste it into the SQL Editor
3. Click **Run** to execute the script

### Step 3: Verify Setup
After running the script, you should see:
- ✅ `tasks` table created
- ✅ `extra_work_logs` table created  
- ✅ `designation` column added to `profiles` table
- ✅ All necessary indexes and RLS policies created

### Step 4: Test the Application
1. Refresh your application
2. Navigate to the Tasks page - it should now work without errors
3. Try creating a task in the Task Manager (admin only)
4. Try adding extra work logs on the Today page

## What the Setup Script Does

### Creates Tables:
- **`tasks`** - For task management (title, description, assigned_to, status, priority, etc.)
- **`extra_work_logs`** - For logging additional work hours (remote work, overtime, etc.)

### Adds Columns:
- **`designation`** - Added to `profiles` table for employee job titles

### Sets Up Security:
- Row Level Security (RLS) policies for data protection
- Users can only access their own data
- Admins and managers have full access

### Creates Indexes:
- Performance indexes for better query speed

## Troubleshooting

### If you still see errors:
1. Check the Supabase logs for any SQL errors
2. Make sure you have the correct permissions
3. Verify all tables were created successfully

### If tables already exist:
The script uses `CREATE TABLE IF NOT EXISTS` so it's safe to run multiple times.

## Files Created
- `setup_database.sql` - Complete database setup script
- `supabase/migrations/20250109000000_add_tasks_and_designations.sql` - Migration file
- `supabase/migrations/20250109000001_add_extra_work_logs.sql` - Migration file

## Next Steps
Once the database is set up, you can:
1. Create and assign tasks to employees
2. Log extra work hours
3. Manage employee designations
4. Use all the new features without errors
