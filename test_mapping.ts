#!/usr/bin/env tsx

import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

/**
 * Test employee mapping with correct data structure
 */

async function testEmployeeMapping() {
  console.log('🔍 Testing employee mapping with correct data structure...\n');

  try {
    const { supabaseService } = await import('./src/integrations/supabase/service');
    const { calculateMatchScore } = await import('./src/services/teamOfficeEmployees');

    // Get TeamOffice employees
    console.log('1. Fetching TeamOffice employees...');
    const { data: teamofficeEmployees, error: empError } = await supabaseService
      .from('teamoffice_employees')
      .select('*')
      .eq('is_active', true);

    if (empError) {
      console.log('❌ Error fetching TeamOffice employees:', empError.message);
      return;
    }

    console.log(`   Found ${teamofficeEmployees?.length || 0} TeamOffice employees`);

    // Get our users
    console.log('2. Fetching our users...');
    const { data: ourUsers, error: userError } = await supabaseService
      .from('profiles')
      .select('id, name, email')
      .eq('is_active', true);

    if (userError) {
      console.log('❌ Error fetching users:', userError.message);
      return;
    }

    console.log(`   Found ${ourUsers?.length || 0} our users`);

    // Test mapping for each employee
    console.log('\n3. Testing mappings...');
    
    if (teamofficeEmployees && ourUsers) {
      for (const emp of teamofficeEmployees) {
        console.log(`\n   Employee: ${emp.name} (${emp.emp_code})`);
        
        // Calculate match scores
        const matches = ourUsers
          .map(user => ({
            user_id: user.id,
            name: user.name,
            email: user.email,
            match_score: calculateMatchScore(
              { Name: emp.name, Email: emp.email }, // Convert to expected format
              { name: user.name, email: user.email }
            )
          }))
          .filter(match => match.match_score >= 0.3)
          .sort((a, b) => b.match_score - a.match_score);

        if (matches.length > 0) {
          console.log(`   Best matches:`);
          matches.slice(0, 3).forEach(match => {
            console.log(`     - ${match.name} (${(match.match_score * 100).toFixed(1)}%)`);
          });
        } else {
          console.log(`   No matches found`);
        }
      }
    }

    // Test specific mapping for Sakshi
    console.log('\n4. Testing Sakshi mapping...');
    const sakshi = teamofficeEmployees?.find(emp => emp.name === 'Sakshi');
    const sakshiUser = ourUsers?.find(user => user.name.toLowerCase().includes('sakshi'));
    
    if (sakshi && sakshiUser) {
      const score = calculateMatchScore(
        { Name: sakshi.name, Email: sakshi.email },
        { name: sakshiUser.name, email: sakshiUser.email }
      );
      console.log(`   Sakshi (${sakshi.emp_code}) -> ${sakshiUser.name}: ${(score * 100).toFixed(1)}%`);
    } else {
      console.log('   Sakshi or Sakshi user not found');
    }

  } catch (error) {
    console.error('❌ Error in mapping test:', error);
  }
}

async function createSakshiMapping() {
  console.log('\n🔗 Creating Sakshi mapping...\n');

  try {
    const { supabaseService } = await import('./src/integrations/supabase/service');

    // Find Sakshi in TeamOffice employees
    const { data: sakshiEmp } = await supabaseService
      .from('teamoffice_employees')
      .select('*')
      .eq('name', 'Sakshi')
      .single();

    // Find Sakshi in our users
    const { data: sakshiUser } = await supabaseService
      .from('profiles')
      .select('*')
      .ilike('name', '%sakshi%')
      .single();

    if (sakshiEmp && sakshiUser) {
      console.log(`   TeamOffice: ${sakshiEmp.name} (${sakshiEmp.emp_code})`);
      console.log(`   Our User: ${sakshiUser.name} (${sakshiUser.id})`);

      // Create mapping
      const { data, error } = await supabaseService
        .from('employee_mappings')
        .insert({
          teamoffice_emp_code: sakshiEmp.emp_code,
          teamoffice_name: sakshiEmp.name,
          our_user_id: sakshiUser.id,
          our_profile_id: sakshiUser.id,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.log('❌ Error creating mapping:', error.message);
      } else {
        console.log('✅ Sakshi mapping created successfully!');
        console.log('   Mapping ID:', data.id);
      }
    } else {
      console.log('❌ Could not find Sakshi in employees or users');
    }

  } catch (error) {
    console.error('❌ Error creating Sakshi mapping:', error);
  }
}

async function main() {
  console.log('🚀 Employee Mapping Test\n');

  await testEmployeeMapping();
  await createSakshiMapping();

  console.log('\n✨ Test completed!');
}

main().catch(console.error);


















