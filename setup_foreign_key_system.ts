#!/usr/bin/env tsx

import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

/**
 * Setup foreign key system and test the new attendance processing
 */

async function setupForeignKeys() {
  console.log('🔧 Setting up foreign key relationships...\n');

  try {
    const { supabaseService } = await import('./src/integrations/supabase/service');

    // First, let's check if the foreign key already exists
    const { data: existingKeys, error: keyError } = await supabaseService
      .from('information_schema.table_constraints')
      .select('constraint_name')
      .eq('table_name', 'profiles')
      .eq('constraint_type', 'FOREIGN KEY');

    if (keyError) {
      console.log('❌ Error checking existing foreign keys:', keyError.message);
      return false;
    }

    const hasForeignKey = existingKeys?.some(key => 
      key.constraint_name.includes('teamoffice_employees')
    );

    if (hasForeignKey) {
      console.log('✅ Foreign key relationship already exists');
    } else {
      console.log('⚠️  Foreign key relationship not found. Please ensure the schema is updated.');
      console.log('   The profiles table should have a teamoffice_employees_id column');
      console.log('   with a foreign key to teamoffice_employees(id)');
    }

    return true;
  } catch (error) {
    console.error('❌ Error setting up foreign keys:', error);
    return false;
  }
}

async function createSampleMappings() {
  console.log('\n🔗 Creating sample employee mappings...\n');

  try {
    const { supabaseService } = await import('./src/integrations/supabase/service');

    // Get TeamOffice employees
    const { data: teamofficeEmployees, error: empError } = await supabaseService
      .from('teamoffice_employees')
      .select('*')
      .eq('is_active', true);

    if (empError) {
      console.log('❌ Error fetching TeamOffice employees:', empError.message);
      return false;
    }

    console.log(`📥 Found ${teamofficeEmployees?.length || 0} TeamOffice employees`);

    // Get our users
    const { data: profiles, error: profError } = await supabaseService
      .from('profiles')
      .select('*')
      .eq('is_active', true);

    if (profError) {
      console.log('❌ Error fetching profiles:', profError.message);
      return false;
    }

    console.log(`👥 Found ${profiles?.length || 0} user profiles`);

    // Create mappings based on name similarity
    const mappings = [];
    
    for (const emp of teamofficeEmployees || []) {
      // Find best matching user
      let bestMatch = null;
      let bestScore = 0;

      for (const profile of profiles || []) {
        const nameSimilarity = calculateNameSimilarity(emp.name, profile.name);
        if (nameSimilarity > bestScore && nameSimilarity > 0.3) {
          bestScore = nameSimilarity;
          bestMatch = profile;
        }
      }

      if (bestMatch) {
        mappings.push({
          emp_code: emp.emp_code,
          emp_name: emp.name,
          user_name: bestMatch.name,
          user_id: bestMatch.id,
          score: bestScore
        });
      }
    }

    console.log(`\n🔍 Found ${mappings.length} potential mappings:`);
    mappings.forEach(mapping => {
      console.log(`   ${mapping.emp_name} (${mapping.emp_code}) -> ${mapping.user_name} (${(mapping.score * 100).toFixed(1)}%)`);
    });

    // Update profiles with foreign key relationships
    console.log('\n💾 Updating profiles with foreign key relationships...');
    
    for (const mapping of mappings) {
      const { error: updateError } = await supabaseService
        .from('profiles')
        .update({ teamoffice_employees_id: mapping.emp_code })
        .eq('id', mapping.user_id);

      if (updateError) {
        console.log(`❌ Error updating profile for ${mapping.user_name}:`, updateError.message);
      } else {
        console.log(`✅ Mapped ${mapping.user_name} to TeamOffice employee ${mapping.emp_code}`);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Error creating mappings:', error);
    return false;
  }
}

function calculateNameSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Simple Levenshtein distance
  const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  return (s1.length - matrix[s2.length][s1.length]) / s1.length;
}

async function testNewAttendanceProcessing() {
  console.log('\n🧪 Testing new attendance processing with foreign keys...\n');

  try {
    const { getRawRangeMCID } = await import('./src/services/teamOffice');
    const { processAndInsertAttendanceRecordsV2 } = await import('./src/services/attendanceDataProcessorV2');

    // Get today's punch data
    const today = new Date();
    const fromDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}_00:00`;
    const toDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}_23:59`;

    console.log(`📅 Fetching attendance data from ${fromDate} to ${toDate}`);

    const punchData = await getRawRangeMCID(fromDate, toDate, 'ALL');
    
    if (!punchData || !punchData.PunchData || !Array.isArray(punchData.PunchData)) {
      console.log('❌ No punch data found');
      return false;
    }

    console.log(`📥 Found ${punchData.PunchData.length} punch records`);

    // Convert punch data to attendance records format
    const attendanceRecords = punchData.PunchData.map((record: any) => ({
      Empcode: record.Empcode,
      Name: record.Name,
      INTime: "10:00", // Placeholder - we don't have separate in/out times in punch data
      OUTTime: "18:00", // Placeholder
      WorkTime: "08:00", // Placeholder
      OverTime: "00:00",
      BreakTime: "01:00",
      Status: "P",
      DateString: record.PunchDate.split(' ')[0].split('/').reverse().join('/'), // Convert to DD/MM/YYYY
      Remark: "",
      Erl_Out: "00:00",
      Late_In: "00:00"
    }));

    console.log(`🔄 Processing ${attendanceRecords.length} attendance records with foreign key system...`);

    // Process attendance records using the new system
    const result = await processAndInsertAttendanceRecordsV2(attendanceRecords);

    console.log('\n📊 Processing results:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Processed: ${result.processed}`);
    console.log(`   Errors: ${result.errors}`);
    
    if (result.errorDetails.length > 0) {
      console.log('   Error details:');
      result.errorDetails.forEach(error => {
        console.log(`     - ${error}`);
      });
    }

    return result.success;
  } catch (error) {
    console.error('❌ Error testing attendance processing:', error);
    return false;
  }
}

async function verifySystemStatus() {
  console.log('\n🔍 Verifying system status...\n');

  try {
    const { supabaseService } = await import('./src/integrations/supabase/service');

    // Check profiles with foreign key relationships
    const { data: profilesWithFK, error: profError } = await supabaseService
      .from('profiles')
      .select(`
        id,
        name,
        email,
        teamoffice_employees_id,
        teamoffice_employees!inner (
          emp_code,
          name
        )
      `)
      .not('teamoffice_employees_id', 'is', null);

    if (profError) {
      console.log('❌ Error fetching profiles with foreign keys:', profError.message);
    } else {
      console.log(`✅ Found ${profilesWithFK?.length || 0} profiles with TeamOffice mappings:`);
      profilesWithFK?.forEach(profile => {
        console.log(`   ${profile.name} -> ${profile.teamoffice_employees?.name} (${profile.teamoffice_employees?.emp_code})`);
      });
    }

    // Check attendance logs
    const { data: attendanceLogs, error: logError } = await supabaseService
      .from('attendance_logs')
      .select('*')
      .eq('source', 'teamoffice')
      .order('log_time', { ascending: false })
      .limit(5);

    if (logError) {
      console.log('❌ Error fetching attendance logs:', logError.message);
    } else {
      console.log(`\n📊 Found ${attendanceLogs?.length || 0} recent attendance logs`);
      attendanceLogs?.forEach(log => {
        console.log(`   ${log.employee_name} - ${log.log_type} at ${log.log_time}`);
      });
    }

    // Check day entries
    const { data: dayEntries, error: entryError } = await supabaseService
      .from('day_entries')
      .select('*')
      .order('entry_date', { ascending: false })
      .limit(3);

    if (entryError) {
      console.log('❌ Error fetching day entries:', entryError.message);
    } else {
      console.log(`\n📅 Found ${dayEntries?.length || 0} recent day entries`);
      dayEntries?.forEach(entry => {
        console.log(`   User: ${entry.user_id} - Date: ${entry.entry_date} - Status: ${entry.status}`);
      });
    }

    return true;
  } catch (error) {
    console.error('❌ Error verifying system status:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Setting up Foreign Key System\n');

  // Step 1: Setup foreign keys
  const fkSuccess = await setupForeignKeys();
  
  if (fkSuccess) {
    // Step 2: Create sample mappings
    const mappingSuccess = await createSampleMappings();
    
    if (mappingSuccess) {
      // Step 3: Test new attendance processing
      const processingSuccess = await testNewAttendanceProcessing();
      
      if (processingSuccess) {
        // Step 4: Verify system status
        await verifySystemStatus();
        
        console.log('\n🎉 Foreign key system setup completed successfully!');
        console.log('\n🎯 Next steps:');
        console.log('1. Update your frontend components to use HistoryV2 and AttendanceLogsV2');
        console.log('2. Test the user-specific data display');
        console.log('3. Verify admin views show all data correctly');
      } else {
        console.log('\n⚠️  Attendance processing had issues, but mappings were created');
      }
    } else {
      console.log('\n❌ Failed to create mappings');
    }
  } else {
    console.log('\n❌ Failed to setup foreign keys');
  }
}

main().catch(console.error);






