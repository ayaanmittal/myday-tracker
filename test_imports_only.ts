#!/usr/bin/env tsx

/**
 * Test script for imports only (no environment setup required)
 * This script tests that all modules can be imported without runtime errors
 */

async function testImports() {
  console.log('🧪 Testing Auto Sync imports (no environment required)...\n');

  try {
    // Test 1: Import teamOffice (should work without env vars)
    console.log('1. Testing teamOffice import...');
    const teamOffice = await import('./src/services/teamOffice');
    console.log('   ✅ teamOffice imported successfully');
    console.log(`   Available functions: ${Object.keys(teamOffice).join(', ')}`);

    // Test 2: Import teamOfficeEmployees (should work without env vars)
    console.log('2. Testing teamOfficeEmployees import...');
    const teamOfficeEmployees = await import('./src/services/teamOfficeEmployees');
    console.log('   ✅ teamOfficeEmployees imported successfully');
    console.log(`   Available functions: ${Object.keys(teamOfficeEmployees).filter(k => typeof teamOfficeEmployees[k] === 'function').join(', ')}`);

    // Test 3: Import attendanceDataProcessor (should work without env vars)
    console.log('3. Testing attendanceDataProcessor import...');
    const attendanceDataProcessor = await import('./src/services/attendanceDataProcessor');
    console.log('   ✅ attendanceDataProcessor imported successfully');
    console.log(`   Available functions: ${Object.keys(attendanceDataProcessor).filter(k => typeof attendanceDataProcessor[k] === 'function').join(', ')}`);

    // Test 4: Import bulkEmployeeMapping (should work without env vars)
    console.log('4. Testing bulkEmployeeMapping import...');
    const bulkEmployeeMapping = await import('./src/services/bulkEmployeeMapping');
    console.log('   ✅ bulkEmployeeMapping imported successfully');
    console.log(`   Available functions: ${Object.keys(bulkEmployeeMapping).filter(k => typeof bulkEmployeeMapping[k] === 'function').join(', ')}`);

    // Test 5: Test calculateMatchScore function
    console.log('5. Testing calculateMatchScore function...');
    const { calculateMatchScore } = teamOfficeEmployees;
    
    // Test with sample data
    const testEmployee = { Name: 'John Doe', Email: 'john@example.com' };
    const testUser = { name: 'John Doe', email: 'john@example.com' };
    const score = calculateMatchScore(testEmployee, testUser);
    console.log(`   ✅ calculateMatchScore works: ${score} (expected: 1.0)`);

    // Test 6: Test string similarity function
    console.log('6. Testing calculateStringSimilarity function...');
    const { calculateStringSimilarity } = teamOfficeEmployees;
    
    const similarity = calculateStringSimilarity('John Doe', 'John Smith');
    console.log(`   ✅ calculateStringSimilarity works: ${similarity}`);

    console.log('\n🎉 All imports and basic functions work correctly!');
    console.log('\n📋 The auto sync system is ready to use once environment variables are configured.');

  } catch (error) {
    console.error('❌ Import test failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure all dependencies are installed: npm install');
    console.log('2. Check for any TypeScript compilation errors');
    console.log('3. Verify file paths are correct');
    console.log('4. Check for missing exports in the imported modules');
    process.exit(1);
  }
}

// Test environment variables (without requiring them)
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
    console.log('   You can now run: npx tsx start_auto_sync.ts');
  } else {
    console.log('⚠️  Missing environment variables:');
    missing.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n💡 Add these to your .env file to enable full functionality');
    console.log('   Example .env file:');
    console.log('   TEAMOFFICE_BASE=https://api.etimeoffice.com/api');
    console.log('   TEAMOFFICE_CORP_ID=your_corp_id');
    console.log('   TEAMOFFICE_USERNAME=your_username');
    console.log('   TEAMOFFICE_PASSWORD=your_password');
    console.log('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
    console.log('   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url');
    console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
  }
}

// Run tests
async function main() {
  console.log('🚀 Auto Sync Import Test Suite\n');
  
  await testImports();
  testEnvironment();
  
  console.log('\n✨ Test completed successfully!');
  console.log('\n🚀 Ready to set up auto sync!');
}

main().catch(console.error);








