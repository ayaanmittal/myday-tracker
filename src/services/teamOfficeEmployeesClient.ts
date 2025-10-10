import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';

export interface TeamOfficeEmployee {
  emp_code: string;
  name: string;
  email?: string;
  department?: string;
  designation?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeMapping {
  id: string;
  teamoffice_emp_code: string;
  teamoffice_name: string;
  our_user_id: string;
  our_user_name: string;
  our_user_email: string;
  match_score: number;
  created_at: string;
  updated_at: string;
}

export interface UnmappedEmployee {
  emp_code: string;
  name: string;
  email?: string;
  department?: string;
  designation?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

function basicAuthHeader() {
  // For client-side, we'll need to get these from a different source
  // or pass them as parameters. For now, return empty string.
  return '';
}

export async function fetchTeamOfficeEmployees(): Promise<TeamOfficeEmployee[]> {
  try {
    // This would need to be called from a server-side API endpoint
    // since we can't expose API credentials in the client
    console.warn('fetchTeamOfficeEmployees should be called from server-side only');
    return [];
  } catch (error) {
    console.error('Error fetching TeamOffice employees:', error);
    throw error;
  }
}

export async function syncTeamOfficeEmployees(): Promise<{
  success: boolean;
  synced: number;
  errors: string[];
}> {
  try {
    // This would need to be called from a server-side API endpoint
    console.warn('syncTeamOfficeEmployees should be called from server-side only');
    return {
      success: false,
      synced: 0,
      errors: ['This function should be called from server-side only']
    };
  } catch (error) {
    console.error('Error syncing TeamOffice employees:', error);
    return {
      success: false,
      synced: 0,
      errors: [`Error: ${error}`]
    };
  }
}

export async function getTeamOfficeEmployees(): Promise<TeamOfficeEmployee[]> {
  try {
    const { data, error } = await supabase
      .from('teamoffice_employees')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching TeamOffice employees from database:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting TeamOffice employees:', error);
    return [];
  }
}

export async function getEmployeeMappings(): Promise<EmployeeMapping[]> {
  try {
    const { data, error } = await supabase
      .from('employee_mappings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching employee mappings:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting employee mappings:', error);
    return [];
  }
}

export async function createEmployeeMapping(
  teamofficeEmpCode: string,
  teamofficeName: string,
  ourUserId: string,
  ourUserName: string,
  ourUserEmail: string,
  matchScore: number = 1.0
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('employee_mappings')
      .insert({
        teamoffice_emp_code: teamofficeEmpCode,
        teamoffice_name: teamofficeName,
        our_user_id: ourUserId,
        our_user_name: ourUserName,
        our_user_email: ourUserEmail,
        match_score: matchScore
      });

    if (error) {
      console.error('Error creating employee mapping:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating employee mapping:', error);
    return { success: false, error: `Error: ${error}` };
  }
}

export async function deleteEmployeeMapping(mappingId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('employee_mappings')
      .delete()
      .eq('id', mappingId);

    if (error) {
      console.error('Error deleting employee mapping:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting employee mapping:', error);
    return { success: false, error: `Error: ${error}` };
  }
}

export async function getUnmappedEmployees(): Promise<UnmappedEmployee[]> {
  try {
    // Get all TeamOffice employees
    const teamOfficeEmployees = await getTeamOfficeEmployees();
    
    // Get all mapped employee codes
    const mappings = await getEmployeeMappings();
    const mappedCodes = new Set(mappings.map(m => m.teamoffice_emp_code));
    
    // Filter out mapped employees
    const unmapped = teamOfficeEmployees.filter(emp => !mappedCodes.has(emp.emp_code));
    
    return unmapped;
  } catch (error) {
    console.error('Error getting unmapped employees:', error);
    return [];
  }
}

export function calculateMatchScore(emp: TeamOfficeEmployee, user: { name: string; email: string }): number {
  let score = 0;
  
  // Name similarity (most important)
  const nameSimilarity = calculateStringSimilarity(emp.name.toLowerCase(), user.name.toLowerCase());
  score += nameSimilarity * 0.6;
  
  // Email similarity
  if (emp.email && user.email) {
    const emailSimilarity = calculateStringSimilarity(emp.email.toLowerCase(), user.email.toLowerCase());
    score += emailSimilarity * 0.4;
  }
  
  return Math.min(score, 1); // Cap at 1.0
}

export function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.includes(str2) || str2.includes(str1)) return 0.8;
  
  // Simple character-based similarity
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}


