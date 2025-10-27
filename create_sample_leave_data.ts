import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iurnwjzxqskliuyttomt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cm53anp4cXNrbGl1eXR0b210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4OTk1MTksImV4cCI6MjA3NTQ3NTUxOX0.3AsCg4PHw-4zvxFn7qa7RkFrpS5uD-vZZIUYI8SgS1E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSampleLeaveData() {
  console.log('Creating sample leave data...');

  try {
    // 1. Create employee categories
    console.log('\n1. Creating employee categories...');
    
    const { data: categories, error: categoriesError } = await supabase
      .from('employee_categories')
      .insert([
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
      ])
      .select();

    if (categoriesError) {
      console.error('❌ Error creating categories:', categoriesError.message);
    } else {
      console.log('✅ Employee categories created:', categories?.length);
    }

    // 2. Get leave types (they already exist)
    console.log('\n2. Getting existing leave types...');
    
    const { data: leaveTypes } = await supabase
      .from('leave_types')
      .select('*')
      .limit(3);

    if (leaveTypes && leaveTypes.length > 0) {
      console.log('✅ Found leave types:', leaveTypes.map(lt => lt.name));
    }

    // 3. Create leave policies
    console.log('\n3. Creating leave policies...');
    
    if (categories && leaveTypes) {
      const permanentCategory = categories.find(c => c.name === 'permanent');
      const annualLeave = leaveTypes.find(lt => lt.name === 'Vacation Leave');
      const sickLeave = leaveTypes.find(lt => lt.name === 'Sick Leave');

      if (permanentCategory && annualLeave && sickLeave) {
        const { data: policies, error: policiesError } = await supabase
          .from('leave_policies')
          .insert([
            {
              name: 'Annual Leave for Permanent Employees',
              description: 'Annual leave policy for permanent employees',
              employee_category_id: permanentCategory.id,
              leave_type_id: annualLeave.id,
              max_days_per_year: 21,
              probation_max_days: 5,
              is_paid: true,
              requires_approval: true,
              is_active: true
            },
            {
              name: 'Sick Leave for Permanent Employees',
              description: 'Sick leave policy for permanent employees',
              employee_category_id: permanentCategory.id,
              leave_type_id: sickLeave.id,
              max_days_per_year: 12,
              probation_max_days: 3,
              is_paid: true,
              requires_approval: true,
              is_active: true
            }
          ])
          .select();

        if (policiesError) {
          console.error('❌ Error creating policies:', policiesError.message);
        } else {
          console.log('✅ Leave policies created:', policies?.length);
        }
      }
    }

    // 4. Refresh leave balances
    console.log('\n4. Refreshing leave balances...');
    
    const { data: refreshResult, error: refreshError } = await supabase
      .rpc('refresh_employee_leave_balances', { target_year: 2024 });
    
    if (refreshError) {
      console.error('❌ Error refreshing balances:', refreshError.message);
    } else {
      console.log('✅ Leave balances refreshed:', refreshResult);
    }

    // 5. Check created balances
    console.log('\n5. Checking created balances...');
    
    const { data: balances } = await supabase
      .from('leave_balances')
      .select(`
        *,
        profiles(name, employee_category),
        leave_types(name)
      `)
      .limit(5);

    if (balances && balances.length > 0) {
      console.log('✅ Leave balances created:', balances.length);
      balances.forEach(balance => {
        console.log(`  - ${balance.profiles.name}: ${balance.leave_types.name} - ${balance.allocated_days} days`);
      });
    } else {
      console.log('❌ No leave balances found');
    }

    console.log('\n🎉 Sample leave data setup completed!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

createSampleLeaveData();
