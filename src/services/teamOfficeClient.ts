import { AxiosError } from 'axios';

// Client-side TeamOffice API service (browser-compatible)
// This version doesn't use Node.js modules like 'https'

const API_BASE_URL = 'https://api.etimeoffice.com/api';

function authHeader() {
  // Handle both browser (import.meta.env) and Node.js (process.env) environments
  const isBrowser = typeof window !== 'undefined';
  const env = isBrowser ? import.meta.env : process.env;
  
  const username = [
    env.VITE_TEAMOFFICE_CORP_ID || env.TEAMOFFICE_CORP_ID || 'trav12009',
    env.VITE_TEAMOFFICE_USERNAME || env.TEAMOFFICE_USERNAME || 'travmax',
    env.VITE_TEAMOFFICE_PASSWORD || env.TEAMOFFICE_PASSWORD || 'ercmax@123',
    'true',
  ].join(':');
  
  // Use Basic Auth with the full credential string as username
  const basicAuth = btoa(`${username}:`);
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
    const response = await fetch(`${API_BASE_URL}/GetLastRecord?lastRecord=102025$0&empcode=ALL`, {
      method: 'GET',
      headers: {
        ...authHeader(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
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
    const response = await fetch(`${API_BASE_URL}/GetLastRecord?lastRecord=${lastRecord}&empcode=${empcode}`, {
      method: 'GET',
      headers: {
        ...authHeader(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    showErr(error);
  }
}

export async function getInOutPunchData(fromDDMMYYYY: string, toDDMMYYYY: string, empcode = 'ALL') {
  try {
    // Use the same endpoint as the server version
    const params = new URLSearchParams({
      Empcode: empcode,
      FromDate: fromDDMMYYYY,
      ToDate: toDDMMYYYY
    });
    
    const response = await fetch(`${API_BASE_URL}/DownloadInOutPunchData?${params}`, {
      method: 'GET',
      headers: {
        ...authHeader(),
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    showErr(error);
  }
}

export async function getRawRangeMCID(fromDDMMYYYY_HHMM: string, toDDMMYYYY_HHMM: string, empcode = 'ALL') {
  try {
    const response = await fetch(`${API_BASE_URL}/GetRawRangeMCID`, {
      method: 'POST',
      headers: {
        ...authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromDate: fromDDMMYYYY_HHMM,
        toDate: toDDMMYYYY_HHMM,
        empcode: empcode
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    showErr(error);
  }
}

// Function for getting latest records using LastRecord API
export async function getLastPunchData(empcode = 'ALL', lastRecord?: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/GetLastPunchData`, {
      method: 'POST',
      headers: {
        ...authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        empcode: empcode,
        lastRecord: lastRecord
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    showErr(error);
  }
}