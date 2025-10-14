#!/usr/bin/env tsx

import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

/**
 * Simple Auto Sync - Test the basic functionality
 */

async function testTeamOfficeAPI() {
  console.log('🔍 Testing TeamOffice API...');
  
  try {
    const { testTeamOfficeConnection } = await import('./src/services/teamOffice');
    const result = await testTeamOfficeConnection();
    
    if (result.success) {
      console.log('✅ TeamOffice API connection successful');
      return true;
    } else {
      console.log('❌ TeamOffice API connection failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ TeamOffice API error:', error);
    return false;
  }
}

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    const { supabaseService } = await import('./src/integrations/supabase/service');
    const { data, error } = await supabaseService
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Supabase connection failed:', error.message);
      return false;
    } else {
      console.log('✅ Supabase connection successful');
      return true;
    }
  } catch (error) {
    console.error('❌ Supabase error:', error);
    return false;
  }
}

async function testEmployeeMapping() {
  console.log('🔍 Testing employee mapping functions...');
  
  try {
    const { calculateMatchScore } = await import('./src/services/teamOfficeEmployees');
    
    // Test the matching function
    const testEmployee = { Name: 'Sakshi', Email: 'sakshi@example.com' };
    const testUser = { name: 'Sakshi Saglotia', email: 'sakshi@example.com' };
    const score = calculateMatchScore(testEmployee, testUser);
    
    console.log(`✅ Employee matching works: ${score} (Sakshi -> Sakshi Saglotia)`);
    return true;
  } catch (error) {
    console.error('❌ Employee mapping error:', error);
    return false;
  }
}

async function runBulkMapping() {
  console.log('🔄 Running bulk employee mapping...');
  
  try {
    const { processBulkEmployeeMapping } = await import('./src/services/bulkEmployeeMapping');
    
    const result = await processBulkEmployeeMapping({
      minMatchScore: 0.3,
      autoMapThreshold: 0.8,
      createMissingUsers: false
    });
    
    console.log('📊 Bulk mapping results:');
    console.log(`   Total processed: ${result.totalProcessed}`);
    console.log(`   Auto-mapped: ${result.autoMapped}`);
    console.log(`   Manual review: ${result.manualReview}`);
    console.log(`   Errors: ${result.errors}`);
    
    return result.success;
  } catch (error) {
    console.error('❌ Bulk mapping error:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Simple Auto Sync Test\n');

  // Test 1: TeamOffice API
  const teamofficeSuccess = await testTeamOfficeAPI();
  
  // Test 2: Supabase
  const supabaseSuccess = await testSupabaseConnection();
  
  // Test 3: Employee mapping
  const mappingSuccess = await testEmployeeMapping();
  
  if (teamofficeSuccess && supabaseSuccess && mappingSuccess) {
    console.log('\n🎉 All basic tests passed!');
    
    // Test 4: Run bulk mapping
    console.log('\n🔄 Running bulk employee mapping...');
    const bulkSuccess = await runBulkMapping();
    
    if (bulkSuccess) {
      console.log('\n✅ Bulk mapping completed successfully!');
      console.log('\n🎯 Next steps:');
      console.log('1. Check your Supabase database for new employee mappings');
      console.log('2. Run attendance sync to get attendance data');
      console.log('3. Set up scheduled sync if needed');
    } else {
      console.log('\n⚠️  Bulk mapping had some issues, but basic functionality works');
    }
  } else {
    console.log('\n❌ Some tests failed. Please check the errors above.');
  }
}

main().catch(console.error);






