#!/usr/bin/env tsx

/**
 * Test script for Auto Data Sync
 * This script tests the auto sync functionality without requiring full environment setup
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testImports() {
  console.log('🧪 Testing Auto Sync imports...\n');

  try {
    // Test 1: Import autoDataSync
    console.log('1. Testing autoDataSync import...');
    const { autoDataSync, AutoDataSync } = await import('./src/services/autoDataSync');
    console.log('   ✅ autoDataSync imported successfully');

    // Test 2: Import bulkEmployeeMapping
    console.log('2. Testing bulkEmployeeMapping import...');
    const { processBulkEmployeeMapping } = await import('./src/services/bulkEmployeeMapping');
    console.log('   ✅ bulkEmployeeMapping imported successfully');

    // Test 3: Import attendanceDataProcessor
    console.log('3. Testing attendanceDataProcessor import...');
    const { processAndInsertAttendanceRecords } = await import('./src/services/attendanceDataProcessor');
    console.log('   ✅ attendanceDataProcessor imported successfully');

    // Test 4: Import teamOfficeEmployees
    console.log('4. Testing teamOfficeEmployees import...');
    const { 
      getTeamOfficeEmployees, 
      getEmployeeMappings, 
      createEmployeeMapping, 
      calculateMatchScore 
    } = await import('./src/services/teamOfficeEmployees');
    console.log('   ✅ teamOfficeEmployees imported successfully');

    // Test 5: Import teamOffice
    console.log('5. Testing teamOffice import...');
    const { testTeamOfficeConnection } = await import('./src/services/teamOffice');
    console.log('   ✅ teamOffice imported successfully');

    console.log('\n🎉 All imports successful! The auto sync system is ready to use.');
    console.log('\n📋 Next steps:');
    console.log('1. Set up your .env file with the required environment variables:');
    console.log('   - TEAMOFFICE_BASE');
    console.log('   - TEAMOFFICE_CORP_ID');
    console.log('   - TEAMOFFICE_USERNAME');
    console.log('   - TEAMOFFICE_PASSWORD');
    console.log('   - SUPABASE_SERVICE_ROLE_KEY');
    console.log('   - NEXT_PUBLIC_SUPABASE_URL');
    console.log('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
    console.log('\n2. Run the full auto sync service:');
    console.log('   npx tsx start_auto_sync.ts');
    console.log('\n3. Or run individual components:');
    console.log('   npx tsx run_bulk_mapping.ts');

  } catch (error) {
    console.error('❌ Import test failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure all dependencies are installed: npm install');
    console.log('2. Check for any TypeScript compilation errors');
    console.log('3. Verify file paths are correct');
    process.exit(1);
  }
}

// Test environment variables
function testEnvironment() {
  console.log('\n🔍 Checking environment variables...\n');

  const requiredVars = [
    'TEAMOFFICE_BASE',
    'TEAMOFFICE_CORP_ID', 
    'TEAMOFFICE_USERNAME',
    'TEAMOFFICE_PASSWORD',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length === 0) {
    console.log('✅ All required environment variables are set');
  } else {
    console.log('⚠️  Missing environment variables:');
    missing.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n💡 Add these to your .env file to enable full functionality');
  }
}

// Run tests
async function main() {
  console.log('🚀 Auto Sync Test Suite\n');
  
  await testImports();
  testEnvironment();
  
  console.log('\n✨ Test completed successfully!');
}

main().catch(console.error);


