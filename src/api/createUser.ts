// Import service client dynamically to ensure environment variables are loaded

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  team?: string;
  designation?: string;
  role?: string;
}

export interface CreateUserResponse {
  success: boolean;
  userId?: string;
  error?: string;
}

export async function createUserAPI(request: CreateUserRequest): Promise<CreateUserResponse> {
  try {
    // Load service client dynamically
    const { supabaseService } = await import('@/integrations/supabase/service');
    
    
    if (!supabaseService) {
      return {
        success: false,
        error: 'Service client not available - SUPABASE_SERVICE_ROLE_KEY not configured'
      };
    }

    // Create user using service client
    const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
      email: request.email,
      password: request.password,
      user_metadata: { name: request.name },
      email_confirm: true,
    });

    if (authError) {
      return {
        success: false,
        error: authError.message || 'Failed to create user'
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'No user data returned'
      };
    }

    // Update profile with team and designation
    const { error: profileError } = await supabaseService
      .from('profiles')
      .update({ 
        team: request.team || null,
        designation: request.designation || null 
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.warn('Error updating profile:', profileError);
    }

    // Update role if not employee
    if (request.role && request.role !== 'employee') {
      const { error: roleError } = await supabaseService
        .from('user_roles')
        .update({ role: request.role })
        .eq('user_id', authData.user.id);

      if (roleError) {
        console.warn('Error updating role:', roleError);
      }
    }

    return {
      success: true,
      userId: authData.user.id
    };

  } catch (error) {
    console.error('Error in createUserAPI:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
