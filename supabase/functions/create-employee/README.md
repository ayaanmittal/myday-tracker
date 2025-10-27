# Create Employee Edge Function

This Edge Function creates new employee accounts with auth users, profiles, and roles using Supabase's Admin API.

## Deployment

To deploy this Edge Function, run:

```bash
supabase functions deploy create-employee
```

Or if you're using the Supabase CLI:

```bash
npx supabase functions deploy create-employee
```

## How It Works

1. **Receives request** with employee details (name, email, password, team, designation, role)
2. **Creates auth user** using `auth.admin.createUser()` with the Admin API
3. **Creates profile** in the `profiles` table
4. **Creates role** in the `user_roles` table
5. **Returns success** with user details

## Usage

From your frontend:

```typescript
const response = await supabase.functions.invoke('create-employee', {
  body: {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'secure123',
    team: 'Engineering',
    designation: 'Developer',
    role: 'employee'
  }
});
```

## Permissions

- **Service Role Key**: Required for accessing Admin API
- **Admin Check**: The function validates that the caller is an admin

## Error Handling

The function includes proper error handling and rollback:
- If profile creation fails after auth user is created, the auth user is deleted
- Returns detailed error messages
- CORS headers included for browser requests

## Environment Variables

Make sure these are set in your Supabase project:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

These are automatically available in Edge Functions when deployed to Supabase.

