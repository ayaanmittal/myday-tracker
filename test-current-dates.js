import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const authHeader = Buffer.from([
  process.env.TEAMOFFICE_CORP_ID,
  process.env.TEAMOFFICE_USERNAME,
  process.env.TEAMOFFICE_PASSWORD,
  'true',
].join(':')).toString('base64');

// Get current date in the correct format
const now = new Date();
const today = now.toLocaleDateString('en-GB').replace(/\//g, '/'); // dd/MM/yyyy format
const todayStart = `${today}_00:00`;
const todayEnd = `${today}_23:59`;

console.log('Testing with current dates:');
console.log('Today:', today);
console.log('FromDate:', todayStart);
console.log('ToDate:', todayEnd);
console.log('');

async function testWithCurrentDates() {
  try {
    console.log('Testing DownloadInOutPunchData with current dates...');
    const { data } = await axios.get('https://api.etimeoffice.com/api/DownloadInOutPunchData', {
      params: { 
        Empcode: 'ALL', 
        FromDate: todayStart, 
        ToDate: todayEnd 
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

async function testLastRecordCurrentMonth() {
  try {
    console.log('\nTesting DownloadLastPunchData with current month...');
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = now.getFullYear();
    const lastRecord = `${currentMonth}${currentYear}$0`;
    
    console.log('LastRecord:', lastRecord);
    
    const { data } = await axios.get('https://api.etimeoffice.com/api/DownloadLastPunchData', {
      params: { 
        Empcode: 'ALL', 
        LastRecord: lastRecord 
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

await testWithCurrentDates();
await testLastRecordCurrentMonth();
