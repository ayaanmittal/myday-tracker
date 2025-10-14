# Stay Signed In System - Implementation Guide

## Overview
The MyDay application now includes a comprehensive "Stay Signed In" system that prevents users from being logged out unexpectedly. This system includes automatic session refresh, persistent storage, and intelligent session management.

## Features Implemented

### 1. Enhanced Authentication System
- **Persistent Sessions**: Sessions are stored in localStorage and persist across browser sessions
- **Automatic Refresh**: Sessions are automatically refreshed every 5 minutes to prevent expiration
- **Smart Session Management**: Only users who opt-in to "Stay Signed In" get extended sessions

### 2. Session Manager (`src/lib/sessionManager.ts`)
A comprehensive session management utility that handles:
- Session initialization and validation
- Automatic session refresh
- Stay signed in preference management
- Session cleanup on sign out

### 3. Enhanced Auth Hook (`src/hooks/useAuth.tsx`)
Updated authentication hook with:
- Session state monitoring
- Automatic refresh triggers
- Stay signed in preference tracking
- Improved error handling

### 4. Session Management
Development tools for session management:
- Current session status
- Time until expiration
- Stay signed in preference
- Session refresh activity

### 5. Enhanced Login Page
- **Stay Signed In Checkbox**: Users can opt-in to persistent sessions
- **Smart Session Handling**: Different behavior based on user preference
- **Visual Feedback**: Clear messaging about session persistence

## How It Works

### For Users Who Choose "Stay Signed In":
1. **Login**: User checks "Stay signed in" and signs in
2. **Preference Storage**: Preference is saved in localStorage
3. **Session Extension**: Session is configured for longer duration
4. **Auto Refresh**: Session is automatically refreshed every 5 minutes
5. **Persistence**: Session persists across browser restarts

### For Users Who Don't Choose "Stay Signed In":
1. **Standard Session**: Normal session behavior
2. **No Auto Refresh**: No automatic session refresh
3. **Session Expiry**: Session expires according to Supabase defaults

## Configuration

### Supabase Client Configuration
```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'sb-iurnwjzxqskliuyttomt-auth-token',
    debug: process.env.NODE_ENV === 'development',
  }
});
```

### Session Manager Configuration
- **Refresh Interval**: 5 minutes (configurable)
- **Storage Keys**: 
  - `stay_signed_in`: Boolean preference
  - `user_preference_stay_signed_in`: Backup preference
- **Session Validation**: Automatic session validity checks

## Usage

### For Developers

#### Using the Session Manager
```typescript
import { sessionManager } from '@/lib/sessionManager';

// Check if user wants to stay signed in
const wantsToStaySignedIn = sessionManager.isStaySignedIn();

// Set stay signed in preference
sessionManager.setStaySignedIn(true);

// Initialize session management
await sessionManager.initialize();

// Check session validity
const isValid = await sessionManager.isSessionValid();
```

#### Using the Enhanced Auth Hook
```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, session, isStaySignedIn, signOut } = useAuth();
  
  // Check if user wants to stay signed in
  if (isStaySignedIn) {
    // User has opted for persistent sessions
  }
}
```

### For Users

#### Enabling Stay Signed In
1. Go to the login page
2. Enter your credentials
3. Check the "Stay signed in" checkbox
4. Click "Sign In"
5. You'll see a confirmation message

#### What Happens When Stay Signed In is Enabled
- ✅ Sessions persist across browser restarts
- ✅ Automatic session refresh every 5 minutes
- ✅ No unexpected logouts
- ✅ Seamless user experience

## Troubleshooting

### Common Issues

#### 1. Still Getting Logged Out
**Possible Causes:**
- Browser is clearing localStorage
- Network connectivity issues
- Supabase session limits

**Solutions:**
- Check browser settings for localStorage
- Verify network connection
- Check Supabase dashboard for session limits

#### 2. Session Monitor Not Showing
**Cause:** Session Monitor only appears in development mode
**Solution:** Check that `NODE_ENV === 'development'`

#### 3. Auto Refresh Not Working
**Possible Causes:**
- User didn't opt for "Stay Signed In"
- Session manager not initialized
- Browser tab is inactive

**Solutions:**
- Ensure user checked "Stay signed in"
- Check console for session manager logs
- Test with active browser tab

### Debug Information

#### Console Logs
The system provides detailed console logging:
- `Auth state change: SIGNED_IN user@example.com`
- `Found existing session for: user@example.com`
- `Session refreshed successfully`
- `Stay signed in preference saved: true`

#### Session Monitor (Development Only)
Shows real-time session information:
- Current user email
- Stay signed in status
- Session expiration time
- Time until expiry
- Session status (Active/Expired)

## Security Considerations

### Data Storage
- Preferences are stored in localStorage (client-side)
- No sensitive data is stored locally
- Session tokens are managed by Supabase

### Session Security
- Sessions are automatically refreshed to maintain security
- Old sessions are properly cleaned up
- Sign out clears all session data

### Best Practices
- Users should only enable "Stay Signed In" on trusted devices
- Regular sign out is recommended for shared computers
- Session monitor should be disabled in production

## Future Enhancements

### Potential Improvements
1. **Remember Device**: Track trusted devices
2. **Session Notifications**: Alert users before session expiry
3. **Multi-Device Sync**: Sync sessions across devices
4. **Session Analytics**: Track session patterns
5. **Custom Expiry**: User-configurable session duration

### Configuration Options
- Refresh interval customization
- Session duration settings
- Device-specific preferences
- Session cleanup policies

## Testing

### Manual Testing
1. **Enable Stay Signed In**: Login with checkbox checked
2. **Close Browser**: Close and reopen browser
3. **Verify Persistence**: Check if still logged in
4. **Check Console**: Verify session refresh logs
5. **Test Sign Out**: Ensure proper cleanup

### Automated Testing
- Session manager unit tests
- Auth hook integration tests
- Session persistence tests
- Auto refresh functionality tests

## Support

### For Users
- Check the "Stay signed in" checkbox when logging in
- Ensure browser allows localStorage
- Contact support if issues persist

### For Developers
- Check console logs for debugging
- Use Session Monitor in development
- Verify Supabase configuration
- Test with different browsers

---

This implementation provides a robust, user-friendly stay signed in system that significantly improves the user experience while maintaining security best practices.
