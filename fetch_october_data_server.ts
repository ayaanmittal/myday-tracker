import { getRawRangeMCID } from './src/services/teamOffice';
import { processAndInsertAttendanceRecordsV3 } from './src/services/attendanceDataProcessorV3';

async function fetchOctoberDataServer() {
  console.log('🚀 Starting October data fetch from TeamOffice API (Server-side)...');
  
  try {
    // Convert dates to TeamOffice format (DD/MM/YYYY_HH:MM)
    const startDate = '01/10/2025_00:00';
    const endDate = '10/10/2025_23:59';
    
    console.log(`📅 Fetching data from ${startDate} to ${endDate}`);
    
    // Fetch raw data from TeamOffice API
    const punchData = await getRawRangeMCID(startDate, endDate, 'ALL');
    
    if (!punchData || !Array.isArray(punchData)) {
      throw new Error('No data received from TeamOffice API');
    }
    
    console.log(`📝 Found ${punchData.length} raw punch records`);
    
    // Convert to TeamOffice format
    const teamOfficeRecords = punchData.map((punch: any) => {
      const punchTime = new Date(punch.PunchDateTime);
      const dateStr = punchTime.toLocaleDateString('en-GB'); // DD/MM/YYYY
      const timeStr = punchTime.toLocaleTimeString('en-GB', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      }); // HH:MM
      
      const io = punch.IO?.toLowerCase().includes('in') ? 'checkin' : 'checkout';
      
      return {
        Empcode: punch.EmpCode || '',
        Name: punch.Name || '',
        DateString: dateStr,
        INTime: io === 'checkin' ? timeStr : '',
        OUTTime: io === 'checkout' ? timeStr : '',
        WorkTime: '00:00',
        Status: 'P',
        Remark: `Device: ${punch.DeviceID || 'unknown'}`,
        DeviceID: punch.DeviceID
      };
    });
    
    console.log(`🔄 Processing ${teamOfficeRecords.length} records...`);
    
    // Process records using V3 processor
    const result = await processAndInsertAttendanceRecordsV3(teamOfficeRecords);
    
    console.log('\n📊 Fetch Results:');
    console.log(`  ✅ Success: ${result.success}`);
    console.log(`  📝 Records Found: ${punchData.length}`);
    console.log(`  🔄 Records Processed: ${result.processed}`);
    console.log(`  ❌ Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n🚨 Errors:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (result.success) {
      console.log('\n🎉 SUCCESS! October data has been fetched and stored in unified_attendance table.');
      console.log('You can now view the data in your attendance logs or admin panel.');
    } else {
      console.log('\n⚠️  WARNING: Data fetch completed with errors.');
      console.log('Some records may not have been processed correctly.');
    }

    return result;

  } catch (error) {
    console.error('❌ CRITICAL ERROR: Failed to fetch October data:', error);
    throw error;
  }
}

// Run the fetch
fetchOctoberDataServer();

