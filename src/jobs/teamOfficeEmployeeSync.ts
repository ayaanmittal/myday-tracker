import * as dotenv from 'dotenv';
import { fetchTeamOfficeEmployees, syncTeamOfficeEmployees } from '../services/teamOfficeEmployees';

// Load environment variables
dotenv.config();

/**
 * Sync TeamOffice employees to our database
 * This job should be run periodically to keep employee data up to date
 */
export async function runEmployeeSync() {
  try {
    console.log('Starting TeamOffice employee sync...');
    
    // Fetch employees from TeamOffice API
    const employees = await fetchTeamOfficeEmployees();
    
    if (employees.length === 0) {
      console.log('No employees found in TeamOffice API');
      return;
    }
    
    // Sync to our database
    const syncedCount = await syncTeamOfficeEmployees(employees);
    
    console.log(`Employee sync completed. Synced ${syncedCount} employees.`);
  } catch (error) {
    console.error('Employee sync failed:', error);
    throw error;
  }
}

/**
 * Run employee sync with error handling
 */
export async function runEmployeeSyncWithRetry(maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await runEmployeeSync();
      return; // Success
    } catch (error) {
      retries++;
      console.error(`Employee sync attempt ${retries} failed:`, error);
      
      if (retries >= maxRetries) {
        console.error('Employee sync failed after all retries');
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, retries) * 1000; // 2s, 4s, 8s
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
