// Fix attendance status for all records
// This script ensures all records have the correct status based on their check-in/out times

import { supabase } from './src/integrations/supabase/client';

async function fixAttendanceStatus() {
  console.log('🔧 Fixing attendance status for all records...');
  
  try {
    // Get all records that need status updates
    const { data: allRecords, error: fetchError } = await supabase
      .from('unified_attendance')
      .select('id, employee_name, check_in_at, check_out_at, status, entry_date')
      .order('entry_date', { ascending: false });
    
    if (fetchError) {
      console.error('Error fetching records:', fetchError);
      return;
    }

    console.log(`Found ${allRecords?.length || 0} total records`);

    // Categorize records
    const recordsToComplete = allRecords?.filter(record => 
      record.check_out_at && record.status !== 'completed'
    ) || [];
    
    const recordsToInProgress = allRecords?.filter(record => 
      record.check_in_at && !record.check_out_at && record.status !== 'in_progress'
    ) || [];
    
    const recordsToAbsent = allRecords?.filter(record => 
      !record.check_in_at && !record.check_out_at && record.status !== 'absent'
    ) || [];

    console.log(`Records to mark as completed: ${recordsToComplete.length}`);
    console.log(`Records to mark as in_progress: ${recordsToInProgress.length}`);
    console.log(`Records to mark as absent: ${recordsToAbsent.length}`);

    // Update records that should be completed
    if (recordsToComplete.length > 0) {
      const { error: completeError } = await supabase
        .from('unified_attendance')
        .update({ status: 'completed' })
        .in('id', recordsToComplete.map(r => r.id));
      
      if (completeError) {
        console.error('Error updating completed records:', completeError);
      } else {
        console.log('✅ Updated records to completed status');
      }
    }

    // Update records that should be in_progress
    if (recordsToInProgress.length > 0) {
      const { error: inProgressError } = await supabase
        .from('unified_attendance')
        .update({ status: 'in_progress' })
        .in('id', recordsToInProgress.map(r => r.id));
      
      if (inProgressError) {
        console.error('Error updating in_progress records:', inProgressError);
      } else {
        console.log('✅ Updated records to in_progress status');
      }
    }

    // Update records that should be absent
    if (recordsToAbsent.length > 0) {
      const { error: absentError } = await supabase
        .from('unified_attendance')
        .update({ status: 'absent' })
        .in('id', recordsToAbsent.map(r => r.id));
      
      if (absentError) {
        console.error('Error updating absent records:', absentError);
      } else {
        console.log('✅ Updated records to absent status');
      }
    }

    // Show some examples of the fixes
    console.log('\n📊 Status Summary:');
    const statusCounts = allRecords?.reduce((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} records`);
    });

    console.log('\n✅ Attendance status fix completed!');

  } catch (error) {
    console.error('Error fixing attendance status:', error);
  }
}

// Run the fix
fixAttendanceStatus();

