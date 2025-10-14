import axios, { AxiosError } from 'axios';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

const api = axios.create({
  baseURL: 'https://api.etimeoffice.com/api',
  timeout: 60000, // Increased to 60 seconds
  // Only add httpsAgent in Node.js environment
  ...(isBrowser ? {} : {
    // @ts-ignore - https module is only available in Node.js
    httpsAgent: new (require('https')).Agent({
      rejectUnauthorized: false // Temporarily disable SSL verification due to expired certificate
    })
  })
});

function authHeader() {
  const username = [
    process.env.TEAMOFFICE_CORP_ID!,
    process.env.TEAMOFFICE_USERNAME!,
    process.env.TEAMOFFICE_PASSWORD!,
    'true',
  ].join(':');
  
  // Use Basic Auth with the full credential string as username
  const basicAuth = Buffer.from(`${username}:`).toString('base64');
  return { Authorization: `Basic ${basicAuth}` };
}

function showErr(e: unknown) {
  const ae = e as AxiosError<any>;
  if (ae.response) {
    console.error('TeamOffice ERR', ae.response.status, ae.response.data);
    throw new Error(`TeamOffice ${ae.response.status}: ${JSON.stringify(ae.response.data)}`);
  }
  console.error('TeamOffice ERR', ae.message);
  throw new Error(ae.message);
}

export async function testTeamOfficeConnection() {
  try {
    const data = await getLastRecord('102025$0');
    return { success: true, data };
  } catch (error) {
    console.error('TeamOffice connection test failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function getLastRecord(lastRecord: string, empcode = 'ALL') {
  try {
    const { data } = await api.get('/DownloadLastPunchData', {
      params: { Empcode: empcode, LastRecord: lastRecord },
      headers: authHeader(),
    });
    return data;
  } catch (e) { showErr(e); }
}

export async function getLastRecordMCID(lastRecord: string, empcode = 'ALL') {
  try {
    const { data } = await api.get('/DownloadLastPunchDataMCID', {
      params: { Empcode: empcode, LastRecord: lastRecord },
      headers: authHeader(),
    });
    return data;
  } catch (e) { showErr(e); }
}

export async function getInOutRange(fromDDMMYYYY_HHMM: string, toDDMMYYYY_HHMM: string, empcode = 'ALL') {
  try {
    const { data } = await api.get('/DownloadInOutPunchData', {
      params: { Empcode: empcode, FromDate: fromDDMMYYYY_HHMM, ToDate: toDDMMYYYY_HHMM },
      headers: authHeader(),
    });
    return data;
  } catch (e) { showErr(e); }
}

export async function getRawRange(fromDDMMYYYY_HHMM: string, toDDMMYYYY_HHMM: string, empcode = 'ALL') {
  try {
    const { data } = await api.get('/DownloadPunchData', {
      params: { Empcode: empcode, FromDate: fromDDMMYYYY_HHMM, ToDate: toDDMMYYYY_HHMM },
      headers: authHeader(),
    });
    return data;
  } catch (e) { showErr(e); }
}

export async function getRawRangeMCID(fromDDMMYYYY_HHMM: string, toDDMMYYYY_HHMM: string, empcode = 'ALL') {
  try {
    const { data } = await api.get('/DownloadPunchDataMCID', {
      params: { Empcode: empcode, FromDate: fromDDMMYYYY_HHMM, ToDate: toDDMMYYYY_HHMM },
      headers: authHeader(),
    });
    return data;
  } catch (e) { showErr(e); }
}

// New function using the IN/OUT API that provides INTime and OUTTime directly
export async function getInOutPunchData(fromDDMMYYYY: string, toDDMMYYYY: string, empcode = 'ALL') {
  try {
    const { data } = await api.get('/DownloadInOutPunchData', {
      params: { 
        Empcode: empcode, 
        FromDate: fromDDMMYYYY, 
        ToDate: toDDMMYYYY 
      },
      headers: authHeader(),
    });
    return data;
  } catch (e) { showErr(e); }
}

// Function for getting latest records using LastRecord API
export async function getLastPunchData(empcode = 'ALL', lastRecord?: string) {
  try {
    const params: any = { Empcode: empcode };
    if (lastRecord) {
      params.LastRecord = lastRecord;
    }
    
    const { data } = await api.get('/DownloadLastPunchData', {
      params,
      headers: authHeader(),
    });
    return data;
  } catch (e) { showErr(e); }
}

// Legacy function names for backward compatibility
export const downloadLastPunchData = getLastRecord;
export const downloadInOutByRange = getInOutRange;
export const downloadRawByRange = getRawRange;