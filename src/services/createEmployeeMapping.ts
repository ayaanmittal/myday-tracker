import { supabaseService } from '@/integrations/supabase/service';

export interface CreateMappingRequest {
  teamofficeEmpCode: string;
  teamofficeName: string;
  ourUserName: string; // Name to search for in profiles
  ourUserEmail?: string; // Optional email for more precise matching
}

export interface MappingResult {
  success: boolean;
  mappingId?: string;
  error?: string;
  userFound?: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Find user by name (and optionally email)
 */
async function findUserByName(name: string, email?: string): Promise<{ id: string; name: string; email: string } | null> {
  try {
    let query = supabaseService
      .from('profiles')
      .select('id, name, email')
      .eq('is_active', true)
      .ilike('name', `%${name}%`);

    if (email) {
      query = query.or(`email.ilike.%${email}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error finding user:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // If multiple matches, prefer exact name match or email match
    if (data.length > 1) {
      const exactMatch = data.find(user => 
        user.name.toLowerCase() === name.toLowerCase()
      );
      if (exactMatch) return exactMatch;

      if (email) {
        const emailMatch = data.find(user => 
          user.email.toLowerCase() === email.toLowerCase()
        );
        if (emailMatch) return emailMatch;
      }
    }

    return data[0];
  } catch (error) {
    console.error('Error in findUserByName:', error);
    return null;
  }
}

/**
 * Create employee mapping between TeamOffice and our user
 */
export async function createEmployeeMapping(
  request: CreateMappingRequest
): Promise<MappingResult> {
  try {
    console.log(`Creating mapping for TeamOffice employee: ${request.teamofficeName} (${request.teamofficeEmpCode})`);

    // Find the user in our profiles
    const user = await findUserByName(request.ourUserName, request.ourUserEmail);
    
    if (!user) {
      return {
        success: false,
        error: `User not found: ${request.ourUserName}${request.ourUserEmail ? ` (${request.ourUserEmail})` : ''}`
      };
    }

    console.log(`Found user: ${user.name} (${user.email}) - ID: ${user.id}`);

    // Check if mapping already exists
    const { data: existingMapping, error: checkError } = await supabaseService
      .from('employee_mappings')
      .select('*')
      .eq('teamoffice_emp_code', request.teamofficeEmpCode)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking existing mapping:', checkError);
      return {
        success: false,
        error: `Error checking existing mapping: ${checkError.message}`
      };
    }

    if (existingMapping) {
      console.log('Mapping already exists, updating...');
      
      // Update existing mapping
      const { data, error: updateError } = await supabaseService
        .from('employee_mappings')
        .update({
          teamoffice_name: request.teamofficeName,
          our_user_id: user.id,
          our_profile_id: user.id,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('teamoffice_emp_code', request.teamofficeEmpCode)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating mapping:', updateError);
        return {
          success: false,
          error: `Error updating mapping: ${updateError.message}`
        };
      }

      return {
        success: true,
        mappingId: data.id,
        userFound: user
      };
    } else {
      console.log('Creating new mapping...');
      
      // Create new mapping
      const { data, error: insertError } = await supabaseService
        .from('employee_mappings')
        .insert({
          teamoffice_emp_code: request.teamofficeEmpCode,
          teamoffice_name: request.teamofficeName,
          our_user_id: user.id,
          our_profile_id: user.id,
          is_active: true
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating mapping:', insertError);
        return {
          success: false,
          error: `Error creating mapping: ${insertError.message}`
        };
      }

      return {
        success: true,
        mappingId: data.id,
        userFound: user
      };
    }

  } catch (error) {
    console.error('Error in createEmployeeMapping:', error);
    return {
      success: false,
      error: `Unexpected error: ${error}`
    };
  }
}

/**
 * Create mapping for Sakshi specifically
 */
export async function createSakshiMapping(): Promise<MappingResult> {
  return await createEmployeeMapping({
    teamofficeEmpCode: '0006',
    teamofficeName: 'Sakshi',
    ourUserName: 'Sakshi Saglotia'
  });
}

/**
 * List all unmapped TeamOffice employees
 */
export async function getUnmappedTeamOfficeEmployees(): Promise<{
  success: boolean;
  employees: Array<{
    emp_code: string;
    name: string;
    email?: string;
  }>;
  error?: string;
}> {
  try {
    // This would need to be implemented based on your TeamOffice API
    // For now, return a placeholder
    return {
      success: true,
      employees: [
        {
          emp_code: '0006',
          name: 'Sakshi',
          email: undefined
        }
      ]
    };
  } catch (error) {
    return {
      success: false,
      employees: [],
      error: `Error fetching unmapped employees: ${error}`
    };
  }
}

/**
 * Verify mapping exists and works
 */
export async function verifyMapping(teamofficeEmpCode: string): Promise<{
  success: boolean;
  mapping?: {
    id: string;
    teamoffice_emp_code: string;
    teamoffice_name: string;
    our_user_id: string;
    our_user_name: string;
    our_user_email: string;
  };
  error?: string;
}> {
  try {
    const { data, error } = await supabaseService
      .from('employee_mappings')
      .select(`
        *,
        profiles:our_user_id (
          id,
          name,
          email
        )
      `)
      .eq('teamoffice_emp_code', teamofficeEmpCode)
      .eq('is_active', true)
      .single();

    if (error) {
      return {
        success: false,
        error: `Error fetching mapping: ${error.message}`
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'No mapping found'
      };
    }

    return {
      success: true,
      mapping: {
        id: data.id,
        teamoffice_emp_code: data.teamoffice_emp_code,
        teamoffice_name: data.teamoffice_name || '',
        our_user_id: data.our_user_id,
        our_user_name: data.profiles?.name || '',
        our_user_email: data.profiles?.email || ''
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error}`
    };
  }
}






