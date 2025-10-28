import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iurnwjzxqskliuyttomt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cm53anp4cXNrbGl1eXR0b210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4OTk1MTksImV4cCI6MjA3NTQ3NTUxOX0.3AsCg4PHw-4zvxFn7qa7RkFrpS5uD-vZZIUYI8SgS1E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupSampleData() {
  console.log('Setting up sample data for leave system...');

  try {
    // 1. Create employee categories
    console.log('\n1. Creating employee categories...');
    
    const { data: categories, error: categoriesError } = await supabase
      .from('employee_categories')
      .upsert([
        {
          name: 'permanent',
          description: 'Permanent employees with full benefits',
          is_paid_leave_eligible: true,
          probation_period_months: 3,
          is_active: true
        },
        {
          name: 'temporary',
          description: 'Temporary employees with limited benefits',
          is_paid_leave_eligible: false,
          probation_period_months: 0,
          is_active: true
        },
        {
          name: 'intern',
          description: 'Interns with no paid leave',
          is_paid_leave_eligible: false,
          probation_period_months: 0,
          is_active: true
        }
      ], { onConflict: 'name' });

    if (categoriesError) {
      console.error('❌ Error creating categories:', categoriesError.message);
    } else {
      console.log('✅ Employee categories created');
    }

    // 2. Create leave types
    console.log('\n2. Creating leave types...');
    
    const { data: leaveTypes, error: leaveTypesError } = await supabase
      .from('leave_types')
      .upsert([
        {
          name: 'Annual Leave',
          description: 'Annual vacation leave',
          is_paid: true,
          requires_approval: true,
          is_active: true
        },
        {
          name: 'Sick Leave',
          description: 'Sick leave for health issues',
          is_paid: true,
          requires_approval: true,
          is_active: true
        },
        {
          name: 'Personal Leave',
          description: 'Personal leave for personal matters',
          is_paid: false,
          requires_approval: true,
          is_active: true
        }
      ], { onConflict: 'name' });

    if (leaveTypesError) {
      console.error('❌ Error creating leave types:', leaveTypesError.message);
    } else {
      console.log('✅ Leave types created');
    }

    // 3. Get the created IDs
    const { data: categoryData } = await supabase
      .from('employee_categories')
      .select('id, name');
    
    const { data: leaveTypeData } = await supabase
      .from('leave_types')
      .select('id, name');

    const permanentCategoryId = categoryData?.find(c => c.name === 'permanent')?.id;
    const annualLeaveId = leaveTypeData?.find(l => l.name === 'Annual Leave')?.id;
    const sickLeaveId = leaveTypeData?.find(l => l.name === 'Sick Leave')?.id;

    // 4. Create leave policies
    console.log('\n3. Creating leave policies...');
    
    const { data: policies, error: policiesError } = await supabase
      .from('leave_policies')
      .upsert([
        {
          name: 'Annual Leave for Permanent Employees',
          description: 'Annual leave policy for permanent employees',
          employee_category_id: permanentCategoryId,
          leave_type_id: annualLeaveId,
          max_days_per_year: 21,
          probation_max_days: 5,
          is_paid: true,
          requires_approval: true,
          is_active: true
        },
        {
          name: 'Sick Leave for Permanent Employees',
          description: 'Sick leave policy for permanent employees',
          employee_category_id: permanentCategoryId,
          leave_type_id: sickLeaveId,
          max_days_per_year: 12,
          probation_max_days: 3,
          is_paid: true,
          requires_approval: true,
          is_active: true
        }
      ], { onConflict: 'name' });

    if (policiesError) {
      console.error('❌ Error creating policies:', policiesError.message);
    } else {
      console.log('✅ Leave policies created');
    }

    // 5. Update some profiles with sample data
    console.log('\n4. Updating sample profiles...');
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .limit(5);

    if (profiles && profiles.length > 0) {
      const updates = profiles.map((profile, index) => ({
        id: profile.id,
        employee_category: index < 3 ? 'permanent' : index < 4 ? 'temporary' : 'intern',
        joined_on_date: new Date(2024 - Math.floor(Math.random() * 2), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
        probation_period_months: index < 3 ? 3 : 0
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('profiles')
          .update({
            employee_category: update.employee_category,
            joined_on_date: update.joined_on_date,
            probation_period_months: update.probation_period_months
          })
          .eq('id', update.id);

        if (error) {
          console.error(`❌ Error updating profile ${update.id}:`, error.message);
        }
      }
      console.log('✅ Sample profiles updated');
    }

    // 6. Refresh leave balances
    console.log('\n5. Refreshing leave balances...');
    
    const { data: refreshResult, error: refreshError } = await supabase
      .rpc('refresh_employee_leave_balances', { target_year: 2024 });
    
    if (refreshError) {
      console.error('❌ Error refreshing balances:', refreshError.message);
    } else {
      console.log('✅ Leave balances refreshed:', refreshResult);
    }

    console.log('\n🎉 Sample data setup completed!');
    console.log('\nYou can now:');
    console.log('- Go to Settings → Leave Settings');
    console.log('- View the Leave Balances tab');
    console.log('- See sample employee data with leave allocations');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupSampleData();

