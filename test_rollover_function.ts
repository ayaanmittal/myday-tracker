import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iurnwjzxqskliuyttomt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cm53anp4cXNrbGl1eXR0b210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4OTk1MTksImV4cCI6MjA3NTQ3NTUxOX0.3AsCg4PHw-4zvxFn7qa7RkFrpS5uD-vZZIUYI8SgS1E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRolloverFunction() {
  console.log('Testing Rollover Function...');

  try {
    // Test rollover summary function
    console.log('\n1. Testing get_rollover_summary function...');
    
    const { data: summary, error: summaryError } = await supabase
      .rpc('get_rollover_summary', {
        from_year: 2024,
        to_year: 2025
      });
    
    if (summaryError) {
      console.error('❌ get_rollover_summary error:', summaryError.message);
    } else {
      console.log('✅ get_rollover_summary working:', summary);
    }

    // Test rollover function
    console.log('\n2. Testing rollover_leave_balances function...');
    
    const { data: rollover, error: rolloverError } = await supabase
      .rpc('rollover_leave_balances', {
        from_year: 2024,
        to_year: 2025,
        max_rollover_days: 5
      });
    
    if (rolloverError) {
      console.error('❌ rollover_leave_balances error:', rolloverError.message);
    } else {
      console.log('✅ rollover_leave_balances working:', rollover);
    }

    console.log('\n✅ Rollover function test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRolloverFunction();

