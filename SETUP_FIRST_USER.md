# Setting Up Your First User Account

## The Problem
You're getting a 401 Unauthorized error because no user exists in your Supabase database yet. This guide will help you create your first admin user.

## Method 1: Using Supabase Dashboard (Easiest)

### Step 1: Go to Supabase Dashboard
1. Visit: https://supabase.com/dashboard/project/iurnwjzxqskliuyttomt/auth/users
2. Or go to: https://supabase.com/dashboard → Select your project → Authentication → Users

### Step 2: Create User
1. Click **"Add user"** or **"Create new user"**
2. Choose **"Create user"** (not "Invite user" unless you want email verification)
3. Fill in:
   - **Email**: your email address (e.g., `admin@example.com`)
   - **Password**: Choose a strong password
   - **Auto Confirm User**: ✅ Check this box (so you can log in immediately)
   - **Email Confirmed**: ✅ Check this box
4. Click **"Create user"**

### Step 3: Create Profile and Role
After creating the auth user, you need to create their profile in the database.

1. Go to: https://supabase.com/dashboard/project/iurnwjzxqskliuyttomt/editor
2. Click on the **SQL Editor**
3. Run this SQL (replace `USER_EMAIL` and `USER_ID`):

```sql
-- First, get the user ID from auth.users
-- Replace 'your-email@example.com' with the email you just created
DO $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT := 'your-email@example.com'; -- CHANGE THIS
BEGIN
  -- Get the user ID
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = v_user_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found with email: %', v_user_email;
  END IF;
  
  -- Create profile
  INSERT INTO public.profiles (id, name, email, team, designation, is_active, user_id)
  VALUES (
    v_user_id,
    'Admin User', -- Change name as needed
    v_user_email,
    'Admin', -- Change team as needed
    'Administrator', -- Change designation as needed
    true,
    v_user_id
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Create admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
  
  RAISE NOTICE 'Profile and admin role created for user: %', v_user_email;
END $$;
```

### Step 4: Login
Now you can log in with the email and password you created!

---

## Method 2: Using Supabase Auth Sign Up API (Alternative)

If you want to allow self-registration, you can temporarily enable it:

### Step 1: Enable Email Sign Up
1. Go to: https://supabase.com/dashboard/project/iurnwjzxqskliuyttomt/auth/providers
2. Under **Email**, make sure **"Enable Email Signup"** is checked
3. Under **Email Confirmation**, you can disable it for immediate login:
   - Uncheck **"Confirm email"** 

### Step 2: Create Sign Up Endpoint
The app doesn't currently have a sign-up page, but you can create a user using the Supabase client directly:

```javascript
// In browser console or temporary script
const { data, error } = await supabase.auth.signUp({
  email: 'admin@example.com',
  password: 'your-password-here'
});
```

Then create the profile and role as shown in Method 1, Step 3.

---

## Method 3: Using SQL Directly (Advanced)

If you have access to the database directly, you can create a user entirely via SQL:

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create user in auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@example.com',
  crypt('your-password-here', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  now(),
  now()
) RETURNING id;

-- Then use the returned ID to create profile and role (see Method 1, Step 3)
```

---

## Troubleshooting

### "Invalid login credentials" after creating user
- Make sure `email_confirmed_at` is set (check in Supabase dashboard)
- Make sure the password you're using matches what was set
- Try resetting the password via Supabase dashboard

### "User created but can't access app features"
- Make sure the profile was created (check `profiles` table)
- Make sure the role was assigned (check `user_roles` table)
- Verify the `user_id` in profiles matches the `id` in auth.users

### Check if user exists
```sql
-- Check auth users
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users;

-- Check profiles
SELECT id, name, email, user_id 
FROM public.profiles;

-- Check roles
SELECT user_id, role 
FROM public.user_roles;
```

---

## Quick Test

After creating your user, try logging in with:
- Email: The email you created
- Password: The password you set

If successful, you should be redirected to `/today`!







