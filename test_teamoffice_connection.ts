#!/usr/bin/env tsx

import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

/**
 * Test TeamOffice API connection
 */

async function testTeamOfficeConnection() {
  console.log('🔍 Testing TeamOffice API Connection...\n');

  try {
    // Test 1: Import teamOffice service
    console.log('1. Importing TeamOffice service...');
    const { testTeamOfficeConnection } = await import('./src/services/teamOffice');
    console.log('   ✅ TeamOffice service imported successfully');

    // Test 2: Test connection
    console.log('2. Testing API connection...');
    const result = await testTeamOfficeConnection();
    
    if (result.success) {
      console.log('   ✅ TeamOffice API connection successful!');
      console.log('   📊 Response data available');
    } else {
      console.log('   ❌ TeamOffice API connection failed');
      console.log(`   Error: ${result.error}`);
    }

    return result.success;

  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
}

async function testSupabaseConnection() {
  console.log('\n🔍 Testing Supabase Connection...\n');

  try {
    // Test 1: Import supabase service
    console.log('1. Importing Supabase service...');
    const { supabaseService } = await import('./src/integrations/supabase/service');
    console.log('   ✅ Supabase service imported successfully');

    // Test 2: Test connection
    console.log('2. Testing database connection...');
    const { data, error } = await supabaseService
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('   ❌ Supabase connection failed');
      console.log(`   Error: ${error.message}`);
      return false;
    } else {
      console.log('   ✅ Supabase connection successful!');
      return true;
    }

  } catch (error) {
    console.error('❌ Supabase test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Connection Test Suite\n');

  // Check environment variables
  console.log('🔍 Environment Variables:');
  console.log(`   TEAMOFFICE_BASE: ${process.env.TEAMOFFICE_BASE ? 'SET' : 'NOT SET'}`);
  console.log(`   TEAMOFFICE_CORP_ID: ${process.env.TEAMOFFICE_CORP_ID ? 'SET' : 'NOT SET'}`);
  console.log(`   TEAMOFFICE_USERNAME: ${process.env.TEAMOFFICE_USERNAME ? 'SET' : 'NOT SET'}`);
  console.log(`   TEAMOFFICE_PASSWORD: ${process.env.TEAMOFFICE_PASSWORD ? 'SET' : 'NOT SET'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET'}`);
  console.log('');

  // Test connections
  const teamofficeSuccess = await testTeamOfficeConnection();
  const supabaseSuccess = await testSupabaseConnection();

  console.log('\n📊 Test Results:');
  console.log(`   TeamOffice API: ${teamofficeSuccess ? '✅ Connected' : '❌ Failed'}`);
  console.log(`   Supabase: ${supabaseSuccess ? '✅ Connected' : '❌ Failed'}`);

  if (teamofficeSuccess && supabaseSuccess) {
    console.log('\n🎉 All connections successful!');
    console.log('   You can now run: npx tsx start_auto_sync.ts');
  } else {
    console.log('\n⚠️  Some connections failed. Please check the errors above.');
  }
}

main().catch(console.error);
















