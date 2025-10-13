import { fetchAttendanceDataFromAPI } from '../services/autoFetchService';

export async function fetchOctoberAttendanceData() {
  console.log('🚀 Starting October attendance data fetch...');
  console.log('📅 Date range: October 1, 2025 to today');
  
  try {
    const result = await fetchAttendanceDataFromAPI({
      startDate: '2025-10-01', // October 1st
      endDate: new Date().toISOString().split('T')[0], // Today
      forceRefresh: true
    });

    console.log('\n📊 Fetch Results Summary:');
    console.log(`  ✅ Success: ${result.success}`);
    console.log(`  📝 Records Found: ${result.recordsFound}`);
    console.log(`  🔄 Records Processed: ${result.recordsProcessed}`);
    console.log(`  ❌ Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n🚨 Detailed Errors:');
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
      console.log('Check the errors above for details.');
    }

    return result;

  } catch (error) {
    console.error('❌ CRITICAL ERROR: Failed to fetch October data:', error);
    throw error;
  }
}

// Make it available globally for browser console
if (typeof window !== 'undefined') {
  (window as any).fetchOctoberAttendanceData = fetchOctoberAttendanceData;
  console.log('💡 You can also run: fetchOctoberAttendanceData() in the browser console');
}

