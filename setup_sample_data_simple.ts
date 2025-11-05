import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iurnwjzxqskliuyttomt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cm53anp4cXNrbGl1eXR0b210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4OTk1MTksImV4cCI6MjA3NTQ3NTUxOX0.3AsCg4PHw-4zvxFn7qa7RkFrpS5uD-vZZIUYI8SgS1E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupSampleDataSimple() {
  console.log('Setting up sample data for leave system...');

  try {
    // 1. Check if categories already exist
    console.log('\n1. Checking existing categories...');
    
    const { data: existingCategories } = await supabase
      .from('employee_categories')
      .select('*');

    if (existingCategories && existingCategories.length > 0) {
      console.log('✅ Categories already exist:', existingCategories.map(c => c.name));
    } else {
      console.log('❌ No categories found');
    }

    // 2. Check if leave types already exist
    console.log('\n2. Checking existing leave types...');
    
    const { data: existingLeaveTypes } = await supabase
      .from('leave_types')
      .select('*');

    if (existingLeaveTypes && existingLeaveTypes.length > 0) {
      console.log('✅ Leave types already exist:', existingLeaveTypes.map(l => l.name));
    } else {
      console.log('❌ No leave types found');
    }

    // 3. Check if policies already exist
    console.log('\n3. Checking existing policies...');
    
    const { data: existingPolicies } = await supabase
      .from('leave_policies')
      .select('*');

    if (existingPolicies && existingPolicies.length > 0) {
      console.log('✅ Policies already exist:', existingPolicies.map(p => p.name));
    } else {
      console.log('❌ No policies found');
    }

    // 4. Check profiles
    console.log('\n4. Checking profiles...');
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, employee_category, joined_on_date')
      .limit(5);

    if (profiles && profiles.length > 0) {
      console.log('✅ Profiles found:', profiles.map(p => ({ name: p.name, category: p.employee_category, joined: p.joined_on_date })));
    } else {
      console.log('❌ No profiles found');
    }

    // 5. Check leave balances
    console.log('\n5. Checking leave balances...');
    
    const { data: balances } = await supabase
      .from('leave_balances')
      .select('*')
      .limit(5);

    if (balances && balances.length > 0) {
      console.log('✅ Leave balances found:', balances.length, 'records');
    } else {
      console.log('❌ No leave balances found');
    }

    // 6. Try to refresh balances
    console.log('\n6. Refreshing leave balances...');
    
    const { data: refreshResult, error: refreshError } = await supabase
      .rpc('refresh_employee_leave_balances', { target_year: 2024 });
    
    if (refreshError) {
      console.error('❌ Error refreshing balances:', refreshError.message);
    } else {
      console.log('✅ Leave balances refreshed:', refreshResult);
    }

    console.log('\n🎉 Sample data check completed!');
    console.log('\nYou can now:');
    console.log('- Go to Settings → Leave Settings');
    console.log('- View the Leave Balances tab');
    console.log('- See employee data with leave allocations');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupSampleDataSimple();



