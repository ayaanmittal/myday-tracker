import { supabaseService } from '@/integrations/supabase/service';
import { getRawRangeMCID } from './teamOffice';

export interface BiometricEmployee {
  Name: string;
  Empcode: string;
  PunchDate: string;
  M_Flag: any;
  ID?: number;
  Table?: string;
  EmpcardNo?: string;
  mcid?: string;
}

export interface EmployeeProfile {
  id: string;
  email: string;
  name: string;
  designation: string | null;
  team: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Extract unique employees from biometric data
 */
export function extractUniqueEmployees(biometricData: BiometricEmployee[]): BiometricEmployee[] {
  const uniqueEmployees = new Map<string, BiometricEmployee>();
  
  biometricData.forEach(emp => {
    if (emp.Name && emp.Empcode) {
      const key = `${emp.Empcode}-${emp.Name}`;
      if (!uniqueEmployees.has(key)) {
        uniqueEmployees.set(key, emp);
      }
    }
  });
  
  return Array.from(uniqueEmployees.values());
}

/**
 * Generate email from name and empcode
 */
export function generateEmail(name: string, empcode: string): string {
  const cleanName = name.toLowerCase().replace(/\s+/g, '');
  return `${cleanName}${empcode}@myday.local`;
}

/**
 * Create employee profile in database
 */
export async function createEmployeeProfile(employee: BiometricEmployee): Promise<EmployeeProfile | null> {
  try {
    const email = generateEmail(employee.Name, employee.Empcode);
    
    // Check if profile already exists by email
    const { data: existingProfile } = await supabaseService
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();
    
    if (existingProfile) {
      console.log(`Profile already exists for ${employee.Name} (${employee.Empcode})`);
      return existingProfile as EmployeeProfile;
    }
    
    // Create new profile
    const { data: newProfile, error } = await supabaseService
      .from('profiles')
      .insert({
        id: crypto.randomUUID(),
        email,
        name: employee.Name,
        designation: 'Employee',
        team: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating profile:', error);
      return null;
    }
    
    console.log(`Created profile for ${employee.Name} (${employee.Empcode})`);
    return newProfile as EmployeeProfile;
    
  } catch (error) {
    console.error('Error in createEmployeeProfile:', error);
    return null;
  }
}

/**
 * Sync all employees from biometric data
 */
export async function syncEmployeesFromBiometric(): Promise<{
  success: boolean;
  created: number;
  existing: number;
  errors: number;
  employees: EmployeeProfile[];
}> {
  try {
    console.log('Starting employee sync from biometric data...');
    
    // Get recent biometric data (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const fromDate = startDate.toLocaleDateString('en-GB') + '_00:00';
    const toDate = endDate.toLocaleDateString('en-GB') + '_23:59';
    
    console.log(`Fetching biometric data from ${fromDate} to ${toDate}`);
    
    const biometricData = await getRawRangeMCID(fromDate, toDate);
    
    if (!biometricData || !biometricData.PunchData || !Array.isArray(biometricData.PunchData)) {
      console.log('No biometric data found');
      return { success: true, created: 0, existing: 0, errors: 0, employees: [] };
    }
    
    console.log(`Found ${biometricData.PunchData.length} biometric records`);
    
    // Extract unique employees
    const uniqueEmployees = extractUniqueEmployees(biometricData.PunchData);
    console.log(`Found ${uniqueEmployees.length} unique employees`);
    
    let created = 0;
    let existing = 0;
    let errors = 0;
    const employees: EmployeeProfile[] = [];
    
    // Create profiles for each unique employee
    for (const employee of uniqueEmployees) {
      const profile = await createEmployeeProfile(employee);
      if (profile) {
        employees.push(profile);
        if (profile.created_at === profile.updated_at) {
          created++;
        } else {
          existing++;
        }
      } else {
        errors++;
      }
    }
    
    console.log(`Employee sync completed: ${created} created, ${existing} existing, ${errors} errors`);
    
    return {
      success: true,
      created,
      existing,
      errors,
      employees
    };
    
  } catch (error) {
    console.error('Error in syncEmployeesFromBiometric:', error);
    return {
      success: false,
      created: 0,
      existing: 0,
      errors: 1,
      employees: []
    };
  }
}

/**
 * Get all employee profiles
 */
export async function getAllEmployeeProfiles(): Promise<EmployeeProfile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching employee profiles:', error);
      return [];
    }
    
    return data as EmployeeProfile[];
  } catch (error) {
    console.error('Error in getAllEmployeeProfiles:', error);
    return [];
  }
}
