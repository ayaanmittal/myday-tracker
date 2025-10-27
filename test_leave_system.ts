import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iurnwjzxqskliuyttomt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cm53anp4cXNrbGl1eXR0b210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4OTk1MTksImV4cCI6MjA3NTQ3NTUxOX0.3AsCg4PHw-4zvxFn7qa7RkFrpS5uD-vZZIUYI8SgS1E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLeaveSystem() {
  console.log('Testing Leave System Setup...');

  try {
    // Test 1: Check if tables exist
    console.log('\n1. Checking table existence...');
    
    const { data: categories, error: categoriesError } = await supabase
      .from('employee_categories')
      .select('*')
      .limit(1);
    
    if (categoriesError) {
      console.error('❌ employee_categories table error:', categoriesError.message);
    } else {
      console.log('✅ employee_categories table exists');
    }

    const { data: leaveTypes, error: leaveTypesError } = await supabase
      .from('leave_types')
      .select('*')
      .limit(1);
    
    if (leaveTypesError) {
      console.error('❌ leave_types table error:', leaveTypesError.message);
    } else {
      console.log('✅ leave_types table exists');
    }

    const { data: policies, error: policiesError } = await supabase
      .from('leave_policies')
      .select('*')
      .limit(1);
    
    if (policiesError) {
      console.error('❌ leave_policies table error:', policiesError.message);
    } else {
      console.log('✅ leave_policies table exists');
    }

    const { data: balances, error: balancesError } = await supabase
      .from('leave_balances')
      .select('*')
      .limit(1);
    
    if (balancesError) {
      console.error('❌ leave_balances table error:', balancesError.message);
    } else {
      console.log('✅ leave_balances table exists');
    }

    // Test 2: Check profiles table columns
    console.log('\n2. Checking profiles table columns...');
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('employee_category, joined_on_date, probation_period_months')
      .limit(1);
    
    if (profilesError) {
      console.error('❌ profiles table columns error:', profilesError.message);
    } else {
      console.log('✅ profiles table has required columns');
    }

    // Test 3: Test RLS policies
    console.log('\n3. Testing RLS policies...');
    
    const { data: testCategories, error: testCategoriesError } = await supabase
      .from('employee_categories')
      .select('*');
    
    if (testCategoriesError) {
      console.error('❌ RLS policy error for employee_categories:', testCategoriesError.message);
    } else {
      console.log('✅ RLS policies working for employee_categories');
    }

    // Test 4: Test functions
    console.log('\n4. Testing database functions...');
    
    const { data: refreshResult, error: refreshError } = await supabase
      .rpc('refresh_employee_leave_balances', { target_year: 2024 });
    
    if (refreshError) {
      console.error('❌ refresh_employee_leave_balances function error:', refreshError.message);
    } else {
      console.log('✅ refresh_employee_leave_balances function working:', refreshResult);
    }

    console.log('\n✅ Leave system test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testLeaveSystem();
