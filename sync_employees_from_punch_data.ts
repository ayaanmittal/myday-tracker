#!/usr/bin/env tsx

import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

/**
 * Sync employees from TeamOffice punch data
 */

async function syncEmployeesFromPunchData() {
  console.log('🔄 Syncing employees from TeamOffice punch data...\n');

  try {
    const { getRawRangeMCID } = await import('./src/services/teamOffice');
    const { supabaseService } = await import('./src/integrations/supabase/service');

    // Get punch data for the last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const fromDate = `${startDate.getDate().toString().padStart(2, '0')}/${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getFullYear()}_00:00`;
    const toDate = `${endDate.getDate().toString().padStart(2, '0')}/${(endDate.getMonth() + 1).toString().padStart(2, '0')}/${endDate.getFullYear()}_23:59`;

    console.log(`📅 Fetching punch data from ${fromDate} to ${toDate}`);

    const punchData = await getRawRangeMCID(fromDate, toDate, 'ALL');
    
    if (!punchData || !punchData.PunchData || !Array.isArray(punchData.PunchData)) {
      console.log('❌ No punch data found');
      return false;
    }

    console.log(`📥 Found ${punchData.PunchData.length} punch records`);

    // Extract unique employees
    const employeeMap = new Map();
    
    punchData.PunchData.forEach((record: any) => {
      if (record.Empcode && record.Name) {
        const key = record.Empcode;
        if (!employeeMap.has(key)) {
          employeeMap.set(key, {
            emp_code: record.Empcode,
            name: record.Name,
            email: null, // We don't have email in punch data
            department: null,
            designation: null,
            is_active: true,
            last_synced_at: new Date().toISOString()
          });
        }
      }
    });

    const uniqueEmployees = Array.from(employeeMap.values());
    console.log(`👥 Found ${uniqueEmployees.length} unique employees`);

    // Insert employees into database
    if (uniqueEmployees.length > 0) {
      console.log('💾 Inserting employees into database...');
      
      const { data, error } = await supabaseService
        .from('teamoffice_employees')
        .upsert(uniqueEmployees, {
          onConflict: 'emp_code'
        });

      if (error) {
        console.log('❌ Error inserting employees:', error.message);
        return false;
      }

      console.log(`✅ Successfully synced ${uniqueEmployees.length} employees`);
      
      // Show the employees
      console.log('\n📋 Synced employees:');
      uniqueEmployees.forEach(emp => {
        console.log(`   ${emp.name} (${emp.emp_code})`);
      });

      return true;
    } else {
      console.log('⚠️  No employees found in punch data');
      return false;
    }

  } catch (error) {
    console.error('❌ Error syncing employees:', error);
    return false;
  }
}

async function runBulkMappingAfterSync() {
  console.log('\n🔄 Running bulk employee mapping after sync...\n');

  try {
    const { processBulkEmployeeMapping } = await import('./src/services/bulkEmployeeMapping');
    
    const result = await processBulkEmployeeMapping({
      minMatchScore: 0.3,
      autoMapThreshold: 0.7, // Lower threshold for better matching
      createMissingUsers: false
    });
    
    console.log('📊 Bulk mapping results:');
    console.log(`   Total processed: ${result.totalProcessed}`);
    console.log(`   Auto-mapped: ${result.autoMapped}`);
    console.log(`   Manual review: ${result.manualReview}`);
    console.log(`   Errors: ${result.errors}`);
    
    if (result.manualReview > 0) {
      console.log('\n⚠️  Manual review needed for:');
      result.results
        .filter(r => r.status === 'manual_review')
        .forEach(r => {
          console.log(`   ${r.teamofficeName} (${r.empCode}) -> ${r.ourUserName} (${(r.matchScore! * 100).toFixed(1)}%)`);
        });
    }

    return result.success;
  } catch (error) {
    console.error('❌ Error in bulk mapping:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Employee Sync from Punch Data\n');

  // Step 1: Sync employees from punch data
  const syncSuccess = await syncEmployeesFromPunchData();
  
  if (syncSuccess) {
    // Step 2: Run bulk mapping
    const mappingSuccess = await runBulkMappingAfterSync();
    
    if (mappingSuccess) {
      console.log('\n🎉 Employee sync and mapping completed successfully!');
      console.log('\n🎯 Next steps:');
      console.log('1. Check your Supabase database for employee mappings');
      console.log('2. Run attendance sync to get attendance data');
      console.log('3. Test the auto sync system');
    } else {
      console.log('\n⚠️  Employee sync completed, but mapping had issues');
    }
  } else {
    console.log('\n❌ Employee sync failed');
  }
}

main().catch(console.error);


















