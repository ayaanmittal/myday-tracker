import * as dotenv from 'dotenv';
import { supabaseService } from './src/integrations/supabase/service';
import { getInOutPunchData } from './src/services/teamOffice';

// Load environment variables
dotenv.config();

async function populateDirectly() {
  console.log('🚀 Populating unified_attendance directly...\n');

  try {
    // Fetch data from TeamOffice IN/OUT API
    const apiResponse = await getInOutPunchData('01/10/2025', '10/10/2025', 'ALL');

    if (!apiResponse || !apiResponse.InOutPunchData || !Array.isArray(apiResponse.InOutPunchData)) {
      throw new Error('No data received from TeamOffice IN/OUT API');
    }

    const punchData = apiResponse.InOutPunchData;
    console.log(`📝 Found ${punchData.length} IN/OUT records`);

    // Get employee mappings
    const { data: mappings, error: mapError } = await supabaseService
      .from('employee_mappings')
      .select('teamoffice_emp_code, our_user_id')
      .eq('is_active', true);

    if (mapError) {
      throw new Error(`Error fetching mappings: ${mapError.message}`);
    }

    console.log(`📋 Found ${mappings?.length || 0} employee mappings`);

    // Create mapping lookup
    const mappingLookup = new Map();
    mappings?.forEach(mapping => {
      mappingLookup.set(mapping.teamoffice_emp_code, mapping.our_user_id);
    });

    let processedCount = 0;
    let skippedCount = 0;

    // Process each record
    for (const record of punchData) {
      const userId = mappingLookup.get(record.Empcode);
      
      if (!userId) {
        console.log(`⏭️  Skipping ${record.Empcode} (${record.Name}) - no mapping found`);
        skippedCount++;
        continue;
      }

      // Parse times
      let checkInAt = null;
      let checkOutAt = null;
      let workMinutes = 0;

      if (record.INTime && record.INTime !== '--:--') {
        checkInAt = new Date(`${record.DateString} ${record.INTime}`).toISOString();
      }

      if (record.OUTTime && record.OUTTime !== '--:--') {
        checkOutAt = new Date(`${record.DateString} ${record.OUTTime}`).toISOString();
      }

      if (record.WorkTime && record.WorkTime !== '00:00') {
        const [hours, minutes] = record.WorkTime.split(':').map(Number);
        workMinutes = hours * 60 + minutes;
      }

      // Determine status
      let status = 'in_progress';
      if (checkOutAt) {
        status = 'completed';
      } else if (record.Status === 'A') {
        status = 'absent';
      }

      // Check if late
      let isLate = false;
      if (checkInAt) {
        const checkInTime = new Date(checkInAt);
        const hour = checkInTime.getHours();
        const minute = checkInTime.getMinutes();
        isLate = hour > 10 || (hour === 10 && minute > 45);
      }

      // Insert record
      const { error: insertError } = await supabaseService
        .from('unified_attendance')
        .insert({
          user_id: userId,
          employee_code: record.Empcode,
          employee_name: record.Name,
          entry_date: record.DateString.split('/').reverse().join('-'), // Convert DD/MM/YYYY to YYYY-MM-DD
          check_in_at: checkInAt,
          check_out_at: checkOutAt,
          total_work_time_minutes: workMinutes,
          status: status,
          is_late: isLate,
          device_info: 'TeamOffice API',
          device_id: 'teamoffice',
          source: 'teamoffice',
          modification_reason: record.Remark && record.Remark !== '--' ? `TeamOffice: ${record.Remark}` : null
        });

      if (insertError) {
        console.log(`❌ Error inserting ${record.Empcode}:`, insertError.message);
      } else {
        console.log(`✅ Processed ${record.Empcode} (${record.Name}) - ${record.DateString}`);
        processedCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Processed: ${processedCount}`);
    console.log(`  ⏭️  Skipped: ${skippedCount}`);
    console.log(`  📝 Total: ${punchData.length}`);

    // Check the populated data
    console.log('\n📋 Checking populated data...');
    const { data: newData, error: newError } = await supabaseService
      .from('unified_attendance')
      .select('id, employee_code, employee_name, entry_date, status, check_in_at, check_out_at, is_late')
      .order('entry_date', { ascending: false })
      .limit(10);
    
    if (newError) {
      console.log('   ❌ Error fetching new data:', newError.message);
    } else {
      console.log(`   ✅ Found ${newData?.length || 0} total attendance records`);
      if (newData && newData.length > 0) {
        console.log('   Recent records:');
        newData.forEach(record => {
          console.log(`     ${record.employee_code}: ${record.employee_name} - ${record.entry_date} (${record.status})${record.is_late ? ' [LATE]' : ''}`);
          if (record.check_in_at) console.log(`       Check-in: ${record.check_in_at}`);
          if (record.check_out_at) console.log(`       Check-out: ${record.check_out_at}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error populating data:', error);
  }
}

populateDirectly();
