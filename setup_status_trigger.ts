// Setup status trigger for unified_attendance table
// This script can be run to set up the automatic status update trigger

import { supabase } from './src/integrations/supabase/client';

async function setupStatusTrigger() {
  console.log('Setting up status update trigger...');
  
  try {
    // Create the function
    const { error: functionError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION update_attendance_status()
        RETURNS TRIGGER AS $$
        BEGIN
          -- If check_out_at is set and status is in_progress, change to completed
          IF NEW.check_out_at IS NOT NULL AND NEW.status = 'in_progress' THEN
            NEW.status := 'completed';
          END IF;
          
          -- If check_out_at is NULL and status is completed, change to in_progress
          IF NEW.check_out_at IS NULL AND NEW.status = 'completed' THEN
            NEW.status := 'in_progress';
          END IF;
          
          -- If both check_in_at and check_out_at are NULL, status should be absent
          IF NEW.check_in_at IS NULL AND NEW.check_out_at IS NULL THEN
            NEW.status := 'absent';
          END IF;
          
          -- If check_in_at exists but check_out_at is NULL, status should be in_progress
          IF NEW.check_in_at IS NOT NULL AND NEW.check_out_at IS NULL THEN
            NEW.status := 'in_progress';
          END IF;
          
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `
    });

    if (functionError) {
      console.error('Error creating function:', functionError);
      return;
    }

    // Create the trigger
    const { error: triggerError } = await supabase.rpc('exec_sql', {
      sql: `
        DROP TRIGGER IF EXISTS trigger_update_attendance_status ON public.unified_attendance;
        
        CREATE TRIGGER trigger_update_attendance_status
          BEFORE INSERT OR UPDATE ON public.unified_attendance
          FOR EACH ROW
          EXECUTE FUNCTION update_attendance_status();
      `
    });

    if (triggerError) {
      console.error('Error creating trigger:', triggerError);
      return;
    }

    console.log('✅ Status update trigger setup successfully!');
    
    // Test the trigger by updating a record
    console.log('Testing trigger...');
    const { data: testData, error: testError } = await supabase
      .from('unified_attendance')
      .select('id, employee_name, check_in_at, check_out_at, status')
      .not('check_out_at', 'is', null)
      .limit(1);
    
    if (testData && testData.length > 0) {
      const testRecord = testData[0];
      console.log('Testing with record:', testRecord.employee_name);
      
      // Try to set status to in_progress (should be changed to completed by trigger)
      const { error: updateError } = await supabase
        .from('unified_attendance')
        .update({ status: 'in_progress' })
        .eq('id', testRecord.id);
      
      if (updateError) {
        console.error('Test update error:', updateError);
      } else {
        // Check if it was changed back to completed
        const { data: updatedData } = await supabase
          .from('unified_attendance')
          .select('status')
          .eq('id', testRecord.id)
          .single();
        
        console.log('Status after update:', updatedData?.status);
        if (updatedData?.status === 'completed') {
          console.log('✅ Trigger is working correctly!');
        } else {
          console.log('❌ Trigger may not be working properly');
        }
      }
    }

  } catch (error) {
    console.error('Error setting up trigger:', error);
  }
}

// Run the setup
setupStatusTrigger();

