import { runLastRecordSync } from './src/jobs/teamOfficeLastRecordSync';

async function fetchOctoberDataSimple() {
  console.log('🚀 Starting October data fetch using existing sync job...');
  
  try {
    // Run the existing sync job which handles everything
    await runLastRecordSync();
    
    console.log('\n🎉 SUCCESS! October data sync completed.');
    console.log('Check the unified_attendance table for the data.');
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR: Failed to sync October data:', error);
    throw error;
  }
}

// Run the fetch
fetchOctoberDataSimple();

