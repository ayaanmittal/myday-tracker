#!/usr/bin/env tsx

import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

/**
 * Debug TeamOffice API and database
 */

async function debugTeamOfficeAPI() {
  console.log('🔍 Debugging TeamOffice API...\n');

  try {
    const { getLastRecordMCID, getRawRangeMCID } = await import('./src/services/teamOffice');
    
    // Test 1: Get last record data
    console.log('1. Testing LastRecord API...');
    try {
      const lastRecordData = await getLastRecordMCID('102025$0', 'ALL');
      console.log('   ✅ LastRecord API response:');
      console.log('   Type:', typeof lastRecordData);
      console.log('   Is Array:', Array.isArray(lastRecordData));
      console.log('   Keys:', lastRecordData ? Object.keys(lastRecordData) : 'null');
      console.log('   Sample data:', JSON.stringify(lastRecordData, null, 2).substring(0, 500) + '...');
    } catch (error) {
      console.log('   ❌ LastRecord API error:', error);
    }

    // Test 2: Get range data
    console.log('\n2. Testing Range API...');
    try {
      const today = new Date();
      const fromDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}_00:00`;
      const toDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}_23:59`;
      
      console.log(`   Fetching data from ${fromDate} to ${toDate}`);
      const rangeData = await getRawRangeMCID(fromDate, toDate, 'ALL');
      console.log('   ✅ Range API response:');
      console.log('   Type:', typeof rangeData);
      console.log('   Is Array:', Array.isArray(rangeData));
      console.log('   Keys:', rangeData ? Object.keys(rangeData) : 'null');
      console.log('   Sample data:', JSON.stringify(rangeData, null, 2).substring(0, 500) + '...');
    } catch (error) {
      console.log('   ❌ Range API error:', error);
    }

  } catch (error) {
    console.error('❌ TeamOffice API debug error:', error);
  }
}

async function debugSupabaseData() {
  console.log('\n🔍 Debugging Supabase data...\n');

  try {
    const { supabaseService } = await import('./src/integrations/supabase/service');
    
    // Check teamoffice_employees table
    console.log('1. Checking teamoffice_employees table...');
    const { data: employees, error: empError } = await supabaseService
      .from('teamoffice_employees')
      .select('*')
      .limit(5);
    
    if (empError) {
      console.log('   ❌ Error fetching employees:', empError.message);
    } else {
      console.log(`   ✅ Found ${employees?.length || 0} employees in database`);
      if (employees && employees.length > 0) {
        console.log('   Sample employee:', employees[0]);
      }
    }

    // Check profiles table
    console.log('\n2. Checking profiles table...');
    const { data: profiles, error: profError } = await supabaseService
      .from('profiles')
      .select('*')
      .limit(5);
    
    if (profError) {
      console.log('   ❌ Error fetching profiles:', profError.message);
    } else {
      console.log(`   ✅ Found ${profiles?.length || 0} profiles in database`);
      if (profiles && profiles.length > 0) {
        console.log('   Sample profile:', profiles[0]);
      }
    }

    // Check employee_mappings table
    console.log('\n3. Checking employee_mappings table...');
    const { data: mappings, error: mapError } = await supabaseService
      .from('employee_mappings')
      .select('*')
      .limit(5);
    
    if (mapError) {
      console.log('   ❌ Error fetching mappings:', mapError.message);
    } else {
      console.log(`   ✅ Found ${mappings?.length || 0} mappings in database`);
      if (mappings && mappings.length > 0) {
        console.log('   Sample mapping:', mappings[0]);
      }
    }

  } catch (error) {
    console.error('❌ Supabase debug error:', error);
  }
}

async function main() {
  console.log('🚀 TeamOffice Debug Suite\n');

  await debugTeamOfficeAPI();
  await debugSupabaseData();

  console.log('\n✨ Debug completed!');
}

main().catch(console.error);


