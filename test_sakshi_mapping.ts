import { createSakshiMapping, verifyMapping } from './src/services/createEmployeeMapping';

/**
 * Test script to create and verify Sakshi's mapping
 */
async function testSakshiMapping() {
  console.log('🔍 Testing Sakshi mapping...\n');

  try {
    // Step 1: Create the mapping
    console.log('1. Creating mapping for Sakshi...');
    const createResult = await createSakshiMapping();
    
    if (createResult.success) {
      console.log('✅ Mapping created successfully!');
      console.log(`   Mapping ID: ${createResult.mappingId}`);
      console.log(`   User: ${createResult.userFound?.name} (${createResult.userFound?.email})`);
    } else {
      console.log('❌ Failed to create mapping:');
      console.log(`   Error: ${createResult.error}`);
      return;
    }

    console.log('\n2. Verifying mapping...');
    
    // Step 2: Verify the mapping
    const verifyResult = await verifyMapping('0006');
    
    if (verifyResult.success && verifyResult.mapping) {
      console.log('✅ Mapping verified successfully!');
      console.log(`   TeamOffice: ${verifyResult.mapping.teamoffice_name} (${verifyResult.mapping.teamoffice_emp_code})`);
      console.log(`   Our User: ${verifyResult.mapping.our_user_name} (${verifyResult.mapping.our_user_email})`);
      console.log(`   User ID: ${verifyResult.mapping.our_user_id}`);
    } else {
      console.log('❌ Failed to verify mapping:');
      console.log(`   Error: ${verifyResult.error}`);
    }

    console.log('\n3. Next steps:');
    console.log('   - Run the attendance processing function');
    console.log('   - Check that Sakshi can see her data in the frontend');
    console.log('   - Verify attendance logs are linked to her user ID');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testSakshiMapping();






