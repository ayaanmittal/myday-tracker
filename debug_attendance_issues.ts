import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Debug script to identify and fix attendance issues
 */
async function debugAttendanceIssues() {
  console.log('🔍 Debugging attendance issues...\n');

  try {
    // 1. Check for records with incorrect status
    console.log('1. Checking for records with incorrect status...');
    const { data: incorrectStatus, error: statusError } = await supabase
      .from('unified_attendance')
      .select(`
        user_id,
        employee_name,
        employee_code,
        entry_date,
        check_in_at,
        check_out_at,
        status,
        created_at
      `)
      .or(`
        and(check_in_at.is.null,check_out_at.is.null,status.neq.absent),
        and(check_in_at.not.is.null,check_out_at.is.null,status.neq.in_progress),
        and(check_in_at.not.is.null,check_out_at.not.is.null,status.neq.completed)
      `)
      .order('entry_date', { ascending: false })
      .limit(20);

    if (statusError) {
      console.error('❌ Error checking status:', statusError);
    } else {
      console.log(`📊 Found ${incorrectStatus?.length || 0} records with incorrect status`);
      if (incorrectStatus && incorrectStatus.length > 0) {
        console.table(incorrectStatus);
      }
    }

    // 2. Check for records with "Unknown" or missing employee names
    console.log('\n2. Checking for records with missing employee names...');
    const { data: missingNames, error: namesError } = await supabase
      .from('unified_attendance')
      .select(`
        user_id,
        employee_name,
        employee_code,
        entry_date,
        check_in_at,
        check_out_at,
        status
      `)
      .or('employee_name.is.null,employee_name.eq.Unknown,employee_name.eq.')
      .order('entry_date', { ascending: false })
      .limit(20);

    if (namesError) {
      console.error('❌ Error checking names:', namesError);
    } else {
      console.log(`👤 Found ${missingNames?.length || 0} records with missing employee names`);
      if (missingNames && missingNames.length > 0) {
        console.table(missingNames);
      }
    }

    // 3. Check employee mappings
    console.log('\n3. Checking employee mappings...');
    const { data: mappings, error: mappingsError } = await supabase
      .from('employee_mappings')
      .select(`
        teamoffice_emp_code,
        teamoffice_name,
        our_user_id,
        is_active,
        profiles!inner(name)
      `)
      .eq('is_active', true)
      .limit(10);

    if (mappingsError) {
      console.error('❌ Error checking mappings:', mappingsError);
    } else {
      console.log(`🔗 Found ${mappings?.length || 0} active employee mappings`);
      if (mappings && mappings.length > 0) {
        console.table(mappings.map(m => ({
          emp_code: m.teamoffice_emp_code,
          teamoffice_name: m.teamoffice_name,
          our_name: m.profiles?.name,
          is_active: m.is_active
        })));
      }
    }

    // 4. Check for Hiralal specifically
    console.log('\n4. Checking Hiralal\'s attendance records...');
    const { data: hiralalRecords, error: hiralalError } = await supabase
      .from('unified_attendance')
      .select(`
        user_id,
        employee_name,
        employee_code,
        entry_date,
        check_in_at,
        check_out_at,
        status,
        total_work_time_minutes
      `)
      .or('employee_name.ilike.%hiralal%,employee_code.ilike.%hiralal%')
      .order('entry_date', { ascending: false })
      .limit(10);

    if (hiralalError) {
      console.error('❌ Error checking Hiralal:', hiralalError);
    } else {
      console.log(`👨‍💼 Found ${hiralalRecords?.length || 0} records for Hiralal`);
      if (hiralalRecords && hiralalRecords.length > 0) {
        console.table(hiralalRecords);
      }
    }

    // 5. Check recent API refresh logs
    console.log('\n5. Checking recent API refresh activity...');
    const { data: refreshLogs, error: refreshError } = await supabase
      .from('api_refresh_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (refreshError) {
      console.error('❌ Error checking refresh logs:', refreshError);
    } else {
      console.log(`🔄 Found ${refreshLogs?.length || 0} recent API refresh logs`);
      if (refreshLogs && refreshLogs.length > 0) {
        console.table(refreshLogs.map(log => ({
          created_at: log.created_at,
          status: log.status,
          records_processed: log.records_processed,
          errors: log.errors
        })));
      }
    }

    console.log('\n✅ Debug analysis complete!');
    console.log('\n📋 Summary of issues found:');
    console.log(`- Records with incorrect status: ${incorrectStatus?.length || 0}`);
    console.log(`- Records with missing names: ${missingNames?.length || 0}`);
    console.log(`- Active employee mappings: ${mappings?.length || 0}`);
    console.log(`- Hiralal's records: ${hiralalRecords?.length || 0}`);

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

/**
 * Fix attendance issues by running the database functions
 */
async function fixAttendanceIssues() {
  console.log('🔧 Running attendance fixes...\n');

  try {
    // Run the status fix function
    console.log('1. Fixing attendance status...');
    const { data: statusFixes, error: statusError } = await supabase
      .rpc('fix_incorrect_attendance_status');

    if (statusError) {
      console.error('❌ Error fixing status:', statusError);
    } else {
      console.log(`✅ Fixed ${statusFixes?.length || 0} status issues`);
      if (statusFixes && statusFixes.length > 0) {
        console.table(statusFixes);
      }
    }

    // Run the name fix function
    console.log('\n2. Fixing employee names...');
    const { data: nameFixes, error: nameError } = await supabase
      .rpc('fix_employee_names');

    if (nameError) {
      console.error('❌ Error fixing names:', nameError);
    } else {
      console.log(`✅ Fixed ${nameFixes?.length || 0} name issues`);
      if (nameFixes && nameFixes.length > 0) {
        console.table(nameFixes);
      }
    }

    console.log('\n✅ All fixes applied successfully!');

  } catch (error) {
    console.error('❌ Fix script error:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--fix')) {
    await fixAttendanceIssues();
  } else {
    await debugAttendanceIssues();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { debugAttendanceIssues, fixAttendanceIssues };
