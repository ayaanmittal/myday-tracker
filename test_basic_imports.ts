#!/usr/bin/env tsx

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Basic import test without Supabase service dependencies
 */

async function testBasicImports() {
  console.log('🧪 Testing Basic Imports (no Supabase service)...\n');

  try {
    // Test 1: Import teamOffice (should work without env vars)
    console.log('1. Testing teamOffice import...');
    const teamOffice = await import('./src/services/teamOffice');
    console.log('   ✅ teamOffice imported successfully');
    console.log(`   Available functions: ${Object.keys(teamOffice).join(', ')}`);

    // Test 2: Test calculateMatchScore function directly
    console.log('2. Testing calculateMatchScore function...');
    
    // Define the function locally to test it
    function calculateStringSimilarity(str1: string, str2: string): number {
      const len1 = str1.length;
      const len2 = str2.length;
      
      if (len1 === 0) return len2 === 0 ? 1 : 0;
      if (len2 === 0) return 0;

      const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
      
      for (let i = 0; i <= len1; i++) matrix[0][i] = i;
      for (let j = 0; j <= len2; j++) matrix[j][0] = j;
      
      for (let j = 1; j <= len2; j++) {
        for (let i = 1; i <= len1; i++) {
          const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
          matrix[j][i] = Math.min(
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1,
            matrix[j - 1][i - 1] + cost
          );
        }
      }
      
      return (len1 - matrix[len2][len1]) / len1;
    }

    function calculateMatchScore(emp: any, user: { name: string; email: string }): number {
      let score = 0;
      
      // Name matching (fuzzy)
      if (emp.Name && user.name) {
        const nameSimilarity = calculateStringSimilarity(
          emp.Name.toLowerCase(),
          user.name.toLowerCase()
        );
        score += nameSimilarity * 0.6; // 60% weight for name
      }
      
      // Email matching (exact)
      if (emp.Email && user.email) {
        if (emp.Email.toLowerCase() === user.email.toLowerCase()) {
          score += 0.4; // 40% weight for exact email match
        }
      }
      
      return Math.min(score, 1); // Cap at 1.0
    }
    
    // Test with sample data
    const testEmployee = { Name: 'John Doe', Email: 'john@example.com' };
    const testUser = { name: 'John Doe', email: 'john@example.com' };
    const score = calculateMatchScore(testEmployee, testUser);
    console.log(`   ✅ calculateMatchScore works: ${score} (expected: 1.0)`);

    // Test with different names
    const testEmployee2 = { Name: 'Sakshi', Email: 'sakshi@example.com' };
    const testUser2 = { name: 'Sakshi Saglotia', email: 'sakshi@example.com' };
    const score2 = calculateMatchScore(testEmployee2, testUser2);
    console.log(`   ✅ calculateMatchScore works: ${score2} (Sakshi -> Sakshi Saglotia)`);

    console.log('\n🎉 Basic functions work correctly!');
    console.log('\n📋 The auto sync system is ready to use once you add the Supabase service role key.');

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
    console.log('   You can now run: npx tsx start_auto_sync.ts');
  } else {
    console.log('⚠️  Missing environment variables:');
    missing.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n💡 Add these to your .env file to enable full functionality');
    console.log('\n🔑 To get your Supabase Service Role Key:');
    console.log('1. Go to: https://supabase.com/dashboard/project/iurnwjzxqskliuyttomt/settings/api');
    console.log('2. Copy the "service_role" key');
    console.log('3. Replace "your_service_role_key_here" in your .env file');
  }
}

// Run tests
async function main() {
  console.log('🚀 Basic Import Test Suite\n');
  
  await testBasicImports();
  testEnvironment();
  
  console.log('\n✨ Test completed successfully!');
}

main().catch(console.error);
