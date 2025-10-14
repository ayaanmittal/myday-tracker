// Debug script to check user role assignment
// Run this in your browser console on the app

import { supabase } from './src/integrations/supabase/client';

async function debugUserRole() {
  console.log('🔍 Debugging User Role Assignment...');
  
  try {
    // 1. Check current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('❌ Error getting user:', userError);
      return;
    }
    
    if (!user) {
      console.log('❌ No user found - not logged in');
      return;
    }
    
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    });
    
    // 2. Check profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Error getting profile:', profileError);
    } else {
      console.log('✅ Profile found:', profile);
    }
    
    // 3. Check user roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id);
    
    if (rolesError) {
      console.error('❌ Error getting roles:', rolesError);
    } else {
      console.log('✅ Roles found:', roles);
    }
    
    // 4. Check if user_roles table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_roles')
      .select('count')
      .limit(1);
    
    if (tableError) {
      console.error('❌ user_roles table issue:', tableError);
    } else {
      console.log('✅ user_roles table accessible');
    }
    
    // 5. Try to assign admin role
    console.log('🔧 Attempting to assign admin role...');
    const { data: insertData, error: insertError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: user.id,
        role: 'admin'
      }, { onConflict: 'user_id' });
    
    if (insertError) {
      console.error('❌ Error assigning admin role:', insertError);
    } else {
      console.log('✅ Admin role assigned successfully!');
      
      // Check roles again
      const { data: newRoles, error: newRolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);
      
      console.log('✅ Updated roles:', newRoles);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the debug function
debugUserRole();
