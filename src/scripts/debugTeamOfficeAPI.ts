import axios from 'axios';

// Debug the API call with detailed logging
async function debugAPI() {
  console.log('🔍 Debugging TeamOffice API Call...\n');
  
  const baseUrl = 'https://api.etimeoffice.com/api';
  const testCredentials = 'support:support:support@1:true';
  const authHeader = Buffer.from(testCredentials).toString('base64');
  
  console.log('📋 Request Details:');
  console.log('Base URL:', baseUrl);
  console.log('Credentials:', testCredentials);
  console.log('Auth Header:', authHeader);
  console.log('Expected Header Value:', 'c3VwcG9ydDpzdXBwb3J0OnN1cHBvcnRAMTp0cnVl');
  console.log('Headers Match:', authHeader === 'c3VwcG9ydDpzdXBwb3J0OnN1cHBvcnRAMTp0cnVl');
  console.log('');
  
  // Test different endpoints
  const endpoints = [
    {
      name: 'DownloadLastPunchData',
      url: `${baseUrl}/DownloadLastPunchData`,
      params: { Empcode: 'ALL', LastRecord: '092020$0' }
    },
    {
      name: 'DownloadInOutPunchData',
      url: `${baseUrl}/DownloadInOutPunchData`,
      params: { Empcode: 'ALL', FromDate: '01/01/2025_00:00', ToDate: '01/01/2025_23:59' }
    },
    {
      name: 'DownloadPunchData',
      url: `${baseUrl}/DownloadPunchData`,
      params: { Empcode: 'ALL', FromDate: '01/01/2025_00:00', ToDate: '01/01/2025_23:59' }
    }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`🧪 Testing ${endpoint.name}...`);
    console.log('URL:', endpoint.url);
    console.log('Params:', endpoint.params);
    console.log('Headers:', { Authorization: authHeader });
    
    try {
      const response = await axios.get(endpoint.url, {
        params: endpoint.params,
        headers: { Authorization: authHeader },
        timeout: 15000,
        validateStatus: () => true // Don't throw on any status code
      });
      
      console.log('✅ Response received');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Headers:', response.headers);
      console.log('Data:', JSON.stringify(response.data, null, 2));
      
    } catch (error: any) {
      console.log('❌ Request failed');
      console.log('Error:', error.message);
      if (error.response) {
        console.log('Response Status:', error.response.status);
        console.log('Response Data:', error.response.data);
      }
    }
    
    console.log('─'.repeat(50));
    console.log('');
  }
  
  // Test with different authentication methods
  console.log('🔐 Testing different auth methods...');
  
  const authMethods = [
    {
      name: 'Basic Auth (standard)',
      headers: { Authorization: `Basic ${authHeader}` }
    },
    {
      name: 'Raw Base64 (as per docs)',
      headers: { Authorization: authHeader }
    },
    {
      name: 'Bearer Token',
      headers: { Authorization: `Bearer ${authHeader}` }
    }
  ];
  
  for (const method of authMethods) {
    console.log(`🧪 Testing ${method.name}...`);
    
    try {
      const response = await axios.get(`${baseUrl}/DownloadLastPunchData`, {
        params: { Empcode: 'ALL', LastRecord: '092020$0' },
        headers: method.headers,
        timeout: 15000,
        validateStatus: () => true
      });
      
      console.log('Status:', response.status);
      console.log('Data:', JSON.stringify(response.data, null, 2));
      
    } catch (error: any) {
      console.log('Error:', error.message);
    }
    
    console.log('─'.repeat(30));
    console.log('');
  }
}

debugAPI().catch(console.error);
