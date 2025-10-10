import axios from 'axios';

// Test with hardcoded values first
const TEAMOFFICE_BASE = 'https://api.etimeoffice.com/api';
const TEST_CREDENTIALS = 'support:support:support@1:true';
const AUTH_HEADER = Buffer.from(TEST_CREDENTIALS).toString('base64');

async function testSimpleAPI() {
  console.log('🧪 Testing TeamOffice API with test credentials...\n');
  console.log('Base URL:', TEAMOFFICE_BASE);
  console.log('Auth Header:', AUTH_HEADER);
  console.log('');

  try {
    // Test 1: LastRecord API
    console.log('1️⃣ Testing LastRecord API...');
    const lastRecordUrl = `${TEAMOFFICE_BASE}/DownloadLastPunchData`;
    console.log('URL:', lastRecordUrl);
    
    const response = await axios.get(lastRecordUrl, {
      params: { 
        Empcode: 'ALL', 
        LastRecord: '092020$0' 
      },
      headers: { 
        Authorization: AUTH_HEADER 
      },
      timeout: 15000
    });
    
    console.log('✅ LastRecord API successful');
    console.log('Status:', response.status);
    console.log('Data type:', typeof response.data);
    console.log('Data length:', Array.isArray(response.data) ? response.data.length : 'Not an array');
    console.log('Sample data:', JSON.stringify(response.data, null, 2));
    
  } catch (error: any) {
    console.error('❌ LastRecord API failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }

  console.log('\n');

  try {
    // Test 2: In/Out API
    console.log('2️⃣ Testing In/Out API...');
    const inOutUrl = `${TEAMOFFICE_BASE}/DownloadInOutPunchData`;
    // Use a fixed date that we know has data (from the debug output)
    const testDate = '01/01/2025';
    console.log('URL:', inOutUrl);
    console.log('Date range:', `${testDate}_00:00 to ${testDate}_23:59`);
    
    const response = await axios.get(inOutUrl, {
      params: { 
        Empcode: 'ALL', 
        FromDate: `${testDate}_00:00`,
        ToDate: `${testDate}_23:59`
      },
      headers: { 
        Authorization: AUTH_HEADER 
      },
      timeout: 15000
    });
    
    console.log('✅ In/Out API successful');
    console.log('Status:', response.status);
    console.log('Data type:', typeof response.data);
    console.log('Data length:', Array.isArray(response.data) ? response.data.length : 'Not an array');
    console.log('Sample data:', JSON.stringify(response.data, null, 2));
    
  } catch (error: any) {
    console.error('❌ In/Out API failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }

  console.log('\n🎉 API testing completed!');
}

// Run the test
testSimpleAPI().catch(console.error);
