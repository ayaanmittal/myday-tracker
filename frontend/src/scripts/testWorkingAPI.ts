import axios from 'axios';

// Test with the exact parameters that worked in debug
const TEAMOFFICE_BASE = 'https://api.etimeoffice.com/api';
const TEST_CREDENTIALS = 'support:support:support@1:true';
const AUTH_HEADER = Buffer.from(TEST_CREDENTIALS).toString('base64');

async function testWorkingAPI() {
  console.log('🧪 Testing TeamOffice API with working parameters...\n');
  console.log('Base URL:', TEAMOFFICE_BASE);
  console.log('Auth Header:', AUTH_HEADER);
  console.log('');

  try {
    // Test 1: DownloadPunchData (API1) - This worked in debug
    console.log('1️⃣ Testing DownloadPunchData API...');
    const url = `${TEAMOFFICE_BASE}/DownloadPunchData`;
    console.log('URL:', url);
    
    const response = await axios.get(url, {
      params: { 
        Empcode: 'ALL', 
        FromDate: '01/01/2025_00:00',
        ToDate: '01/01/2025_23:59'
      },
      headers: { 
        Authorization: AUTH_HEADER 
      },
      timeout: 15000
    });
    
    console.log('✅ DownloadPunchData API successful');
    console.log('Status:', response.status);
    console.log('Data type:', typeof response.data);
    console.log('Data length:', Array.isArray(response.data) ? response.data.length : 'Not an array');
    
    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log('Sample record:', JSON.stringify(response.data[0], null, 2));
    } else if (response.data && typeof response.data === 'object') {
      console.log('Response structure:', Object.keys(response.data));
      if (response.data.data && Array.isArray(response.data.data)) {
        console.log('Data array length:', response.data.data.length);
        console.log('Sample record:', JSON.stringify(response.data.data[0], null, 2));
      }
    }
    
  } catch (error: any) {
    console.error('❌ DownloadPunchData API failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }

  console.log('\n');

  try {
    // Test 2: DownloadInOutPunchData (API3) - This also worked in debug
    console.log('2️⃣ Testing DownloadInOutPunchData API...');
    const url = `${TEAMOFFICE_BASE}/DownloadInOutPunchData`;
    console.log('URL:', url);
    
    const response = await axios.get(url, {
      params: { 
        Empcode: 'ALL', 
        FromDate: '01/01/2025_00:00',
        ToDate: '01/01/2025_23:59'
      },
      headers: { 
        Authorization: AUTH_HEADER 
      },
      timeout: 15000
    });
    
    console.log('✅ DownloadInOutPunchData API successful');
    console.log('Status:', response.status);
    console.log('Data type:', typeof response.data);
    console.log('Data length:', Array.isArray(response.data) ? response.data.length : 'Not an array');
    
    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log('Sample record:', JSON.stringify(response.data[0], null, 2));
    } else if (response.data && typeof response.data === 'object') {
      console.log('Response structure:', Object.keys(response.data));
      if (response.data.data && Array.isArray(response.data.data)) {
        console.log('Data array length:', response.data.data.length);
        console.log('Sample record:', JSON.stringify(response.data.data[0], null, 2));
      }
    }
    
  } catch (error: any) {
    console.error('❌ DownloadInOutPunchData API failed:');
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
testWorkingAPI().catch(console.error);
