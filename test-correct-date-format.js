import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const authHeader = Buffer.from([
  process.env.TEAMOFFICE_CORP_ID,
  process.env.TEAMOFFICE_USERNAME,
  process.env.TEAMOFFICE_PASSWORD,
  'true',
].join(':')).toString('base64');

console.log('Testing with correct date format: dd/MM/yyyy_HH:mm\n');

async function testWithCorrectFormat() {
  try {
    console.log('Testing DownloadInOutPunchData with correct date format...');
    const { data } = await axios.get('https://api.etimeoffice.com/api/DownloadInOutPunchData', {
      params: { 
        Empcode: 'ALL', 
        FromDate: '09/10/2025_00:00', 
        ToDate: '09/10/2025_23:59' 
      },
      headers: { Authorization: authHeader },
      timeout: 10000
    });
    console.log('✅ SUCCESS:', data);
    return true;
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status, error.response?.data);
    return false;
  }
}

async function testLastRecord() {
  try {
    console.log('\nTesting DownloadLastPunchData...');
    const { data } = await axios.get('https://api.etimeoffice.com/api/DownloadLastPunchData', {
      params: { 
        Empcode: 'ALL', 
        LastRecord: '102025$0' 
      },
      headers: { Authorization: authHeader },
      timeout: 10000
    });
    console.log('✅ SUCCESS:', data);
    return true;
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status, error.response?.data);
    return false;
  }
}

async function testRawData() {
  try {
    console.log('\nTesting DownloadPunchData with correct date format...');
    const { data } = await axios.get('https://api.etimeoffice.com/api/DownloadPunchData', {
      params: { 
        Empcode: 'ALL', 
        FromDate: '09/10/2025_00:00', 
        ToDate: '09/10/2025_23:59' 
      },
      headers: { Authorization: authHeader },
      timeout: 10000
    });
    console.log('✅ SUCCESS:', data);
    return true;
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status, error.response?.data);
    return false;
  }
}

await testWithCorrectFormat();
await testLastRecord();
await testRawData();
