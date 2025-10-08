import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user is an admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      throw new Error('Unauthorized - Admin access required');
    }

    // Get date range from request body (optional)
    const body = await req.json().catch(() => ({}));
    
    if (body.startDate && body.endDate) {
      // Mark unlogged days for a date range
      const { error } = await supabaseClient.rpc('mark_unlogged_days_range', {
        start_date: body.startDate,
        end_date: body.endDate,
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Marked unlogged days from ${body.startDate} to ${body.endDate}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Mark unlogged days for yesterday
      const { error } = await supabaseClient.rpc('mark_unlogged_days');

      if (error) throw error;

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Marked unlogged days for yesterday' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});