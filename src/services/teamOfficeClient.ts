import axios, { AxiosError } from 'axios';
import { Buffer } from 'buffer';

const api = axios.create({
  baseURL: 'https://api.etimeoffice.com/api',
  timeout: 60000, // Increased to 60 seconds
});

function authHeader() {
  // Use hardcoded credentials for client-side (these should be safe to expose)
  const username = 'support:support:support@1:true';
  
  // Use Basic Auth with the full credential string as username
  const basicAuth = Buffer.from(`${username}:`).toString('base64');
  return { Authorization: `Basic ${basicAuth}` };
}

function showErr(error: any) {
  console.error('TeamOffice API Error:', error);
  if (error instanceof AxiosError) {
    console.error('Response:', error.response?.data);
    console.error('Status:', error.response?.status);
  }
}

export async function getLastRecord(empcode = 'ALL') {
  try {
    const { data } = await api.get('/DownloadLastRecord', {
      params: { Empcode: empcode },
      headers: authHeader(),
    });
    return data;
  } catch (e) { 
    showErr(e); 
    throw e;
  }
}

export async function getInOutRange(fromDDMMYYYY_HHMM: string, toDDMMYYYY_HHMM: string, empcode = 'ALL') {
  try {
    const { data } = await api.get('/DownloadInOutPunchData', {
      params: { Empcode: empcode, FromDate: fromDDMMYYYY_HHMM, ToDate: toDDMMYYYY_HHMM },
      headers: authHeader(),
    });
    return data;
  } catch (e) { 
    showErr(e); 
    throw e;
  }
}

export async function getRawRange(fromDDMMYYYY_HHMM: string, toDDMMYYYY_HHMM: string, empcode = 'ALL') {
  try {
    const { data } = await api.get('/DownloadRawPunchData', {
      params: { Empcode: empcode, FromDate: fromDDMMYYYY_HHMM, ToDate: toDDMMYYYY_HHMM },
      headers: authHeader(),
    });
    return data;
  } catch (e) { 
    showErr(e); 
    throw e;
  }
}

export async function getRawRangeMCID(fromDDMMYYYY_HHMM: string, toDDMMYYYY_HHMM: string, empcode = 'ALL') {
  try {
    const { data } = await api.get('/DownloadRawPunchDataMCID', {
      params: { Empcode: empcode, FromDate: fromDDMMYYYY_HHMM, ToDate: toDDMMYYYY_HHMM },
      headers: authHeader(),
    });
    return data;
  } catch (e) { 
    showErr(e); 
    throw e;
  }
}
