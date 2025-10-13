import { supabaseService } from '@/integrations/supabase/service';
import { getTeamOfficeEmployees, getEmployeeMappings, createEmployeeMapping, calculateMatchScore } from './teamOfficeEmployees';

export interface BulkMappingResult {
  success: boolean;
  totalProcessed: number;
  autoMapped: number;
  manualReview: number;
  errors: number;
  results: Array<{
    empCode: string;
    teamofficeName: string;
    status: 'auto_mapped' | 'manual_review' | 'no_match' | 'error';
    ourUserId?: string;
    ourUserName?: string;
    matchScore?: number;
    error?: string;
    suggestedMatches?: Array<{
      user_id: string;
      name: string;
      email: string;
      match_score: number;
    }>;
  }>;
}

export interface AutoMappingConfig {
  minMatchScore: number; // Minimum score for auto-mapping (0-1)
  autoMapThreshold: number; // Score above which to auto-map (0-1)
  createMissingUsers: boolean; // Whether to create users for unmapped employees
}

const DEFAULT_CONFIG: AutoMappingConfig = {
  minMatchScore: 0.3, // Show matches above 30%
  autoMapThreshold: 0.8, // Auto-map above 80%
  createMissingUsers: false // Don't create users automatically
};

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Get all our users for matching
 */
async function getAllUsers(): Promise<Array<{ id: string; name: string; email: string }>> {
  try {
    const { data, error } = await supabaseService
      .from('profiles')
      .select('id, name, email')
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Create a user profile for unmapped TeamOffice employee
 */
async function createUserForEmployee(emp: any): Promise<string | null> {
  try {
    // Generate email from name and emp code
    const cleanName = emp.Name.toLowerCase().replace(/\s+/g, '');
    const email = `${cleanName}${emp.EmpCode}@myday.local`;
    
    const { data, error } = await supabaseService
      .from('profiles')
      .insert({
        id: crypto.randomUUID(),
        name: emp.Name,
        email: email,
        designation: emp.Designation || 'Employee',
        team: emp.Department || null,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return null;
    }

    console.log(`Created user for ${emp.Name}: ${email}`);
    return data.id;
  } catch (error) {
    console.error('Error in createUserForEmployee:', error);
    return null;
  }
}

/**
 * Process bulk employee mapping
 */
export async function processBulkEmployeeMapping(
  config: Partial<AutoMappingConfig> = {}
): Promise<BulkMappingResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log('🔄 Starting bulk employee mapping...');
  console.log(`Config:`, finalConfig);

  const result: BulkMappingResult = {
    success: true,
    totalProcessed: 0,
    autoMapped: 0,
    manualReview: 0,
    errors: 0,
    results: []
  };

  try {
    // Get all TeamOffice employees
    console.log('📥 Fetching TeamOffice employees...');
    const teamofficeEmployees = await getTeamOfficeEmployees();
    console.log(`Found ${teamofficeEmployees.length} TeamOffice employees`);

    // Get all our users
    console.log('👥 Fetching our users...');
    const ourUsers = await getAllUsers();
    console.log(`Found ${ourUsers.length} our users`);

    // Get existing mappings
    console.log('🔗 Checking existing mappings...');
    const existingMappings = await getEmployeeMappings();
    const mappedEmpCodes = new Set(existingMappings.map(m => m.teamoffice_emp_code));
    console.log(`Found ${existingMappings.length} existing mappings`);

    // Process each TeamOffice employee
    for (const emp of teamofficeEmployees) {
      result.totalProcessed++;
      
      // Skip if already mapped
      if (mappedEmpCodes.has(emp.EmpCode)) {
        console.log(`⏭️  Skipping ${emp.Name} (${emp.EmpCode}) - already mapped`);
        continue;
      }

      console.log(`\n🔍 Processing ${emp.Name} (${emp.EmpCode})...`);

      // Calculate match scores for all users
      const matches = ourUsers
        .map(user => ({
          user_id: user.id,
          name: user.name,
          email: user.email,
          match_score: calculateMatchScore(emp, user)
        }))
        .filter(match => match.match_score >= finalConfig.minMatchScore)
        .sort((a, b) => b.match_score - a.match_score);

      const bestMatch = matches[0];

      if (bestMatch && bestMatch.match_score >= finalConfig.autoMapThreshold) {
        // Auto-map high confidence matches
        try {
          await createEmployeeMapping(emp.EmpCode, bestMatch.user_id);
          
          result.autoMapped++;
          result.results.push({
            empCode: emp.EmpCode,
            teamofficeName: emp.Name,
            status: 'auto_mapped',
            ourUserId: bestMatch.user_id,
            ourUserName: bestMatch.name,
            matchScore: bestMatch.match_score
          });
          
          console.log(`✅ Auto-mapped ${emp.Name} to ${bestMatch.name} (${bestMatch.match_score.toFixed(2)})`);
        } catch (error) {
          result.errors++;
          result.results.push({
            empCode: emp.EmpCode,
            teamofficeName: emp.Name,
            status: 'error',
            error: `Failed to create mapping: ${error}`
          });
          console.log(`❌ Error mapping ${emp.Name}: ${error}`);
        }
      } else if (bestMatch) {
        // Manual review for medium confidence matches
        result.manualReview++;
        result.results.push({
          empCode: emp.EmpCode,
          teamofficeName: emp.Name,
          status: 'manual_review',
          ourUserId: bestMatch.user_id,
          ourUserName: bestMatch.name,
          matchScore: bestMatch.match_score,
          suggestedMatches: matches.slice(0, 5)
        });
        
        console.log(`⚠️  Manual review needed for ${emp.Name} - best match: ${bestMatch.name} (${bestMatch.match_score.toFixed(2)})`);
      } else if (finalConfig.createMissingUsers) {
        // Create new user if no matches found
        try {
          const newUserId = await createUserForEmployee(emp);
          if (newUserId) {
            await createEmployeeMapping(emp.EmpCode, newUserId);
            
            result.autoMapped++;
            result.results.push({
              empCode: emp.EmpCode,
              teamofficeName: emp.Name,
              status: 'auto_mapped',
              ourUserId: newUserId,
              ourUserName: emp.Name,
              matchScore: 1.0
            });
            
            console.log(`🆕 Created new user and mapped ${emp.Name}`);
          } else {
            result.errors++;
            result.results.push({
              empCode: emp.EmpCode,
              teamofficeName: emp.Name,
              status: 'error',
              error: 'Failed to create user'
            });
          }
        } catch (error) {
          result.errors++;
          result.results.push({
            empCode: emp.EmpCode,
            teamofficeName: emp.Name,
            status: 'error',
            error: `Failed to create user: ${error}`
          });
        }
      } else {
        // No match found
        result.results.push({
          empCode: emp.EmpCode,
          teamofficeName: emp.Name,
          status: 'no_match',
          suggestedMatches: matches.slice(0, 5)
        });
        
        console.log(`❌ No match found for ${emp.Name}`);
      }
    }

    console.log('\n📊 Bulk mapping completed!');
    console.log(`Total processed: ${result.totalProcessed}`);
    console.log(`Auto-mapped: ${result.autoMapped}`);
    console.log(`Manual review: ${result.manualReview}`);
    console.log(`Errors: ${result.errors}`);

    return result;

  } catch (error) {
    console.error('❌ Error in bulk mapping:', error);
    result.success = false;
    return result;
  }
}

/**
 * Get employees that need manual review
 */
export async function getManualReviewEmployees(): Promise<Array<{
  empCode: string;
  teamofficeName: string;
  suggestedMatches: Array<{
    user_id: string;
    name: string;
    email: string;
    match_score: number;
  }>;
}>> {
  const result = await processBulkEmployeeMapping();
  return result.results
    .filter(r => r.status === 'manual_review')
    .map(r => ({
      empCode: r.empCode,
      teamofficeName: r.teamofficeName,
      suggestedMatches: r.suggestedMatches || []
    }));
}

/**
 * Manually approve a mapping
 */
export async function approveMapping(
  empCode: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await createEmployeeMapping(empCode, userId);
    return { success: true };
  } catch (error) {
    return { success: false, error: `Failed to create mapping: ${error}` };
  }
}

/**
 * Generate mapping report
 */
export function generateMappingReport(result: BulkMappingResult): string {
  let report = `# Employee Mapping Report\n\n`;
  report += `**Summary:**\n`;
  report += `- Total Processed: ${result.totalProcessed}\n`;
  report += `- Auto-mapped: ${result.autoMapped}\n`;
  report += `- Manual Review: ${result.manualReview}\n`;
  report += `- Errors: ${result.errors}\n\n`;

  if (result.results.filter(r => r.status === 'manual_review').length > 0) {
    report += `## Manual Review Required\n\n`;
    result.results
      .filter(r => r.status === 'manual_review')
      .forEach(r => {
        report += `### ${r.teamofficeName} (${r.empCode})\n`;
        report += `**Best Match:** ${r.ourUserName} (${(r.matchScore! * 100).toFixed(1)}%)\n`;
        if (r.suggestedMatches && r.suggestedMatches.length > 1) {
          report += `**Other Options:**\n`;
          r.suggestedMatches.slice(1, 4).forEach(match => {
            report += `- ${match.name} (${(match.match_score * 100).toFixed(1)}%)\n`;
          });
        }
        report += `\n`;
      });
  }

  if (result.results.filter(r => r.status === 'no_match').length > 0) {
    report += `## No Matches Found\n\n`;
    result.results
      .filter(r => r.status === 'no_match')
      .forEach(r => {
        report += `- ${r.teamofficeName} (${r.empCode})\n`;
      });
  }

  return report;
}




