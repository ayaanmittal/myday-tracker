import dotenv from 'dotenv';
import { syncEmployeesFromBiometric } from './src/services/employeeProfileSync.js';

dotenv.config();

console.log('Testing employee sync...');

try {
  const result = await syncEmployeesFromBiometric();
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Error:', error);
}
