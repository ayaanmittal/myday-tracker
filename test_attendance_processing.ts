#!/usr/bin/env tsx

import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

/**
 * Test attendance processing with mapped employees
 */

async function testAttendanceProcessing() {
  console.log('🔍 Testing attendance processing...\n');

  try {
    const { getRawRangeMCID } = await import('./src/services/teamOffice');
    const { processAndInsertAttendanceRecords } = await import('./src/services/attendanceDataProcessor');

    // Get today's punch data
    const today = new Date();
    const fromDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}_00:00`;
    const toDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}_23:59`;

    console.log(`📅 Fetching attendance data from ${fromDate} to ${toDate}`);

    const punchData = await getRawRangeMCID(fromDate, toDate, 'ALL');
    
    if (!punchData || !punchData.PunchData || !Array.isArray(punchData.PunchData)) {
      console.log('❌ No punch data found');
      return;
    }

    console.log(`📥 Found ${punchData.PunchData.length} punch records`);

    // Convert punch data to attendance records format
    const attendanceRecords = punchData.PunchData.map((record: any) => ({
      Empcode: record.Empcode,
      Name: record.Name,
      INTime: "10:00", // Placeholder - we don't have separate in/out times in punch data
      OUTTime: "18:00", // Placeholder
      WorkTime: "08:00", // Placeholder
      OverTime: "00:00",
      BreakTime: "01:00",
      Status: "P",
      DateString: record.PunchDate.split(' ')[0].split('/').reverse().join('/'), // Convert to DD/MM/YYYY
      Remark: "",
      Erl_Out: "00:00",
      Late_In: "00:00"
    }));

    console.log(`🔄 Processing ${attendanceRecords.length} attendance records...`);

    // Process attendance records
    const result = await processAndInsertAttendanceRecords(attendanceRecords);

    console.log('\n📊 Processing results:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Processed: ${result.processed}`);
    console.log(`   Errors: ${result.errors}`);
    
    if (result.errorDetails.length > 0) {
      console.log('   Error details:');
      result.errorDetails.forEach(error => {
        console.log(`     - ${error}`);
      });
    }

    // Check if Sakshi's data was processed
    if (result.processed > 0) {
      console.log('\n✅ Attendance data processed successfully!');
      console.log('   Check your Supabase database for:');
      console.log('   - attendance_logs table (individual check-in/out records)');
      console.log('   - day_entries table (daily summaries)');
    }

  } catch (error) {
    console.error('❌ Error in attendance processing:', error);
  }
}

async function checkProcessedData() {
  console.log('\n🔍 Checking processed data...\n');

  try {
    const { supabaseService } = await import('./src/integrations/supabase/service');

    // Check attendance logs
    const { data: attendanceLogs, error: logError } = await supabaseService
      .from('attendance_logs')
      .select('*')
      .eq('source', 'teamoffice')
      .order('log_time', { ascending: false })
      .limit(10);

    if (logError) {
      console.log('❌ Error fetching attendance logs:', logError.message);
    } else {
      console.log(`📊 Found ${attendanceLogs?.length || 0} attendance logs`);
      if (attendanceLogs && attendanceLogs.length > 0) {
        console.log('   Recent logs:');
        attendanceLogs.forEach(log => {
          console.log(`     ${log.employee_name} (${log.employee_id}) - ${log.log_type} at ${log.log_time}`);
        });
      }
    }

    // Check day entries
    const { data: dayEntries, error: entryError } = await supabaseService
      .from('day_entries')
      .select('*')
      .order('entry_date', { ascending: false })
      .limit(5);

    if (entryError) {
      console.log('❌ Error fetching day entries:', entryError.message);
    } else {
      console.log(`\n📊 Found ${dayEntries?.length || 0} day entries`);
      if (dayEntries && dayEntries.length > 0) {
        console.log('   Recent entries:');
        dayEntries.forEach(entry => {
          console.log(`     User: ${entry.user_id} - Date: ${entry.entry_date} - Status: ${entry.status}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error checking processed data:', error);
  }
}

async function main() {
  console.log('🚀 Attendance Processing Test\n');

  await testAttendanceProcessing();
  await checkProcessedData();

  console.log('\n✨ Test completed!');
}

main().catch(console.error);


