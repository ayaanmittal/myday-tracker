import * as dotenv from 'dotenv';
import { fetchAttendanceDataFromAPIServer } from './src/services/autoFetchServiceServer';

// Load environment variables
dotenv.config();

async function fetchOctoberData() {
  console.log('🚀 Starting October data fetch from TeamOffice API...');
  
  try {
    // Fetch data from October 1st to October 2nd (smaller range for testing)
    const result = await fetchAttendanceDataFromAPIServer({
      startDate: '2025-10-01', // October 1st
      endDate: '2025-10-02', // October 2nd
      forceRefresh: true
    });

    console.log('📊 Fetch Results:');
    console.log(`  ✅ Success: ${result.success}`);
    console.log(`  📝 Records Found: ${result.recordsFound}`);
    console.log(`  🔄 Records Processed: ${result.recordsProcessed}`);
    console.log(`  ❌ Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n🚨 Errors:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (result.success) {
      console.log('\n🎉 October data fetch completed successfully!');
      console.log('Check the unified_attendance table in Supabase to see the data.');
    } else {
      console.log('\n⚠️  October data fetch completed with errors.');
      console.log('Some records may not have been processed correctly.');
    }

  } catch (error) {
    console.error('❌ Failed to fetch October data:', error);
  }
}

// Run the fetch
fetchOctoberData();
