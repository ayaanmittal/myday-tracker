import axios from 'axios';
import { supabaseService } from '@/integrations/supabase/service';

function basicAuthHeader() {
  const tuple = [
    process.env.TEAMOFFICE_CORP_ID,
    process.env.TEAMOFFICE_USERNAME,
    process.env.TEAMOFFICE_PASSWORD,
    process.env.TEAMOFFICE_TRUE_LITERAL || 'true'
  ].join(':');

  const b64 = Buffer.from(tuple).toString('base64');
  return { Authorization: b64 };
}

export interface TeamOfficeEmployee {
  EmpCode: string;
  Name: string;
  Email?: string;
  Department?: string;
  Designation?: string;
  IsActive?: boolean;
}

export interface EmployeeMapping {
  id: string;
  teamoffice_emp_code: string;
  teamoffice_name: string | null;
  teamoffice_email: string | null;
  our_user_id: string;
  our_profile_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnmappedEmployee {
  emp_code: string;
  name: string | null;
  email: string | null;
  department: string | null;
  designation: string | null;
  suggested_matches: Array<{
    user_id: string;
    name: string;
    email: string;
    match_score: number;
  }>;
}

/**
 * Fetch all employees from TeamOffice API
 */
export async function fetchTeamOfficeEmployees(): Promise<TeamOfficeEmployee[]> {
  try {
    const base = process.env.TEAMOFFICE_BASE!;
    const url = `${base}/GetEmployeeList`; // Adjust endpoint based on TeamOffice API docs
    
    const { data } = await axios.get(url, {
      headers: basicAuthHeader(),
      timeout: 30000
    });

    // Normalize response format
    const employees: TeamOfficeEmployee[] = Array.isArray(data) ? data
      : Array.isArray(data?.data) ? data.data
      : data?.employees || [];

    console.log(`Fetched ${employees.length} employees from TeamOffice`);
    return employees;
  } catch (error) {
    console.error('Error fetching TeamOffice employees:', error);
    throw error;
  }
}

/**
 * Sync TeamOffice employees to our database
 */
export async function syncTeamOfficeEmployees(employees: TeamOfficeEmployee[]): Promise<number> {
  try {
    const { data, error } = await supabaseService
      .rpc('sync_teamoffice_employees', {
        p_employees: employees
      });

    if (error) throw error;

    console.log(`Synced ${data} employees to database`);
    return data;
  } catch (error) {
    console.error('Error syncing TeamOffice employees:', error);
    throw error;
  }
}

/**
 * Get all TeamOffice employees from our database
 */
export async function getTeamOfficeEmployees(): Promise<TeamOfficeEmployee[]> {
  try {
    const { data, error } = await supabaseService
      .from('teamoffice_employees')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching TeamOffice employees from database:', error);
    throw error;
  }
}

/**
 * Get all employee mappings
 */
export async function getEmployeeMappings(): Promise<EmployeeMapping[]> {
  try {
    const { data, error } = await supabaseService
      .from('employee_mappings')
      .select(`
        *,
        profiles:our_profile_id (
          id,
          name,
          email
        )
      `)
      .eq('is_active', true)
      .order('teamoffice_name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching employee mappings:', error);
    throw error;
  }
}

/**
 * Get unmapped employees with suggested matches
 */
export async function getUnmappedEmployees(): Promise<UnmappedEmployee[]> {
  try {
    // Get all TeamOffice employees
    const teamofficeEmployees = await getTeamOfficeEmployees();
    
    // Get all existing mappings
    const mappings = await getEmployeeMappings();
    const mappedEmpCodes = new Set(mappings.map(m => m.teamoffice_emp_code));
    
    // Get all our users for matching
    const { data: ourUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('is_active', true);

    if (usersError) throw usersError;

    // Find unmapped employees and suggest matches
    const unmappedEmployees: UnmappedEmployee[] = teamofficeEmployees
      .filter(emp => !mappedEmpCodes.has(emp.EmpCode))
      .map(emp => {
        const suggestedMatches = ourUsers
          ?.map(user => ({
            user_id: user.id,
            name: user.name,
            email: user.email,
            match_score: calculateMatchScore(emp, user)
          }))
          .filter(match => match.match_score > 0.3) // Only show matches with >30% similarity
          .sort((a, b) => b.match_score - a.match_score)
          .slice(0, 5) || []; // Top 5 matches

        return {
          emp_code: emp.EmpCode,
          name: emp.Name,
          email: emp.Email || null,
          department: emp.Department || null,
          designation: emp.Designation || null,
          suggested_matches: suggestedMatches
        };
      });

    return unmappedEmployees;
  } catch (error) {
    console.error('Error getting unmapped employees:', error);
    throw error;
  }
}

/**
 * Create employee mapping
 */
export async function createEmployeeMapping(
  teamofficeEmpCode: string,
  ourUserId: string
): Promise<string> {
  try {
    const { data, error } = await supabaseService
      .rpc('create_employee_mapping', {
        p_teamoffice_emp_code: teamofficeEmpCode,
        p_our_user_id: ourUserId
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating employee mapping:', error);
    throw error;
  }
}

/**
 * Delete employee mapping
 */
export async function deleteEmployeeMapping(mappingId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('employee_mappings')
      .update({ is_active: false })
      .eq('id', mappingId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting employee mapping:', error);
    throw error;
  }
}

/**
 * Calculate match score between TeamOffice employee and our user
 */
export function calculateMatchScore(emp: TeamOfficeEmployee, user: { name: string; email: string }): number {
  let score = 0;
  
  // Name matching (fuzzy)
  if (emp.Name && user.name) {
    const nameSimilarity = calculateStringSimilarity(
      emp.Name.toLowerCase(),
      user.name.toLowerCase()
    );
    score += nameSimilarity * 0.6; // 60% weight for name
  }
  
  // Email matching (exact)
  if (emp.Email && user.email) {
    if (emp.Email.toLowerCase() === user.email.toLowerCase()) {
      score += 0.4; // 40% weight for exact email match
    }
  }
  
  return Math.min(score, 1); // Cap at 1.0
}

/**
 * Get employee mapping for a specific TeamOffice employee code
 */
export async function getEmployeeMapping(teamofficeEmpCode: string) {
  try {
    const { data, error } = await supabaseService
      .rpc('get_employee_mapping', {
        p_teamoffice_emp_code: teamofficeEmpCode
      });

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error getting employee mapping:', error);
    throw error;
  }
}

/**
 * Calculate string similarity using Levenshtein distance
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,      // deletion
        matrix[j - 1][i] + 1,      // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
}
