import { testTeamOfficeConnection, downloadLastPunchData, downloadInOutByRange } from '../services/teamOffice';
import dayjs from 'dayjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testAPI() {
  console.log('🧪 Testing TeamOffice API Connection...\n');
  
  // Test 1: Basic connection test
  console.log('1️⃣ Testing basic connection...');
  const connectionTest = await testTeamOfficeConnection();
  
  if (!connectionTest.success) {
    console.error('❌ Connection test failed:', connectionTest.error);
    return;
  }
  
  console.log('✅ Connection test successful!\n');
  
  // Test 2: LastRecord API
  console.log('2️⃣ Testing LastRecord API...');
  try {
    const lastRecordData = await downloadLastPunchData('092020$0');
    console.log('✅ LastRecord API successful');
    console.log('📊 Records found:', Array.isArray(lastRecordData) ? lastRecordData.length : 'Unknown format');
    console.log('📋 Sample data:', JSON.stringify(lastRecordData, null, 2));
  } catch (error) {
    console.error('❌ LastRecord API failed:', error);
  }
  
  console.log('\n');
  
  // Test 3: In/Out API for today
  console.log('3️⃣ Testing In/Out API for today...');
  try {
    const today = dayjs().format('DD/MM/YYYY');
    const inOutData = await downloadInOutByRange(`${today}_00:00`, `${today}_23:59`);
    console.log('✅ In/Out API successful');
    console.log('📊 Records found:', Array.isArray(inOutData) ? inOutData.length : 'Unknown format');
    console.log('📋 Sample data:', JSON.stringify(inOutData, null, 2));
  } catch (error) {
    console.error('❌ In/Out API failed:', error);
  }
  
  console.log('\n🎉 API testing completed!');
}

// Run the test
testAPI().catch(console.error);
