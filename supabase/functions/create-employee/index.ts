import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role (no auth check needed, we use RPC)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', { supabaseUrl: !!supabaseUrl, supabaseServiceKey: !!supabaseServiceKey });
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (err) {
      console.error('Failed to parse request body:', err);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { name, email, password, team, designation, role } = requestBody;
    console.log('Request received:', { name, email, hasPassword: !!password, team, designation, role });

    if (!name || !email || !password) {
      console.error('Missing required fields:', { name: !!name, email: !!email, hasPassword: !!password });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, email, password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create auth user using admin API with all required fields
    console.log('Attempting to create auth user...');
    
    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.find(u => u.email === email);
    
    if (userExists) {
      console.log('User already exists, creating profile only');
      const userId = userExists.id;
      
      // Create/update profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          name: name,
          email: email,
          team: team || null,
          designation: designation || null,
          is_active: true,
          user_id: userId
        }, { onConflict: 'id' });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        return new Response(
          JSON.stringify({ error: `Failed to create profile: ${profileError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create/update role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: role || 'employee'
        }, { onConflict: 'user_id,role' });

      return new Response(
        JSON.stringify({
          success: true,
          user_id: userId,
          message: 'Employee profile updated successfully.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      email_change_confirm_status: 1,
      user_metadata: {
        name: name,
        team: team,
        designation: designation
      }
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      return new Response(
        JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authData || !authData.user) {
      console.error('No user data returned from auth creation');
      return new Response(
        JSON.stringify({ error: 'Failed to create auth user - no user data returned' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;
    console.log('Auth user created successfully:', userId);

    // Create profile
    console.log('Attempting to create profile...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        name: name,
        email: email,
        team: team || null,
        designation: designation || null,
        is_active: true,
        user_id: userId
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Rollback: delete the auth user if profile creation fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.log('Rolled back auth user');
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
      return new Response(
        JSON.stringify({ error: `Failed to create profile: ${profileError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile created successfully');

    // Create role
    console.log('Attempting to create role...');
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role || 'employee'
      });

    if (roleError) {
      console.error('Role creation error (non-fatal):', roleError);
      // Don't rollback - profile is more important
    } else {
      console.log('Role created successfully');
    }

    console.log('Employee creation completed successfully');
    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        message: 'Employee created successfully. They can now log in.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in create-employee:', error);
    return new Response(
      JSON.stringify({ error: error.message, details: error.toString() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

