import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iurnwjzxqskliuyttomt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cm53anp4cXNrbGl1eXR0b210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1NzQ4NzEsImV4cCI6MjA1MjE1MDg3MX0.8Q5YjJ8Q5YjJ8Q5YjJ8Q5YjJ8Q5YjJ8Q5YjJ8Q5YjJ8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCategoriesRLS() {
  console.log('Testing employee_categories RLS policies...');
  
  try {
    // Test SELECT
    console.log('Testing SELECT...');
    const { data: selectData, error: selectError } = await supabase
      .from('employee_categories')
      .select('*')
      .limit(1);
    
    if (selectError) {
      console.error('SELECT failed:', selectError);
    } else {
      console.log('SELECT successful:', selectData);
    }
    
    // Test INSERT
    console.log('Testing INSERT...');
    const { data: insertData, error: insertError } = await supabase
      .from('employee_categories')
      .insert({
        name: 'Test Category',
        description: 'Test description',
        is_paid_leave_eligible: false,
        probation_period_months: 3,
        is_active: true
      })
      .select();
    
    if (insertError) {
      console.error('INSERT failed:', insertError);
    } else {
      console.log('INSERT successful:', insertData);
      
      // Test UPDATE
      console.log('Testing UPDATE...');
      const { data: updateData, error: updateError } = await supabase
        .from('employee_categories')
        .update({ name: 'Updated Test Category' })
        .eq('id', insertData[0].id)
        .select();
      
      if (updateError) {
        console.error('UPDATE failed:', updateError);
      } else {
        console.log('UPDATE successful:', updateData);
        
        // Test DELETE
        console.log('Testing DELETE...');
        const { error: deleteError } = await supabase
          .from('employee_categories')
          .delete()
          .eq('id', insertData[0].id);
        
        if (deleteError) {
          console.error('DELETE failed:', deleteError);
        } else {
          console.log('DELETE successful');
        }
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testCategoriesRLS();



