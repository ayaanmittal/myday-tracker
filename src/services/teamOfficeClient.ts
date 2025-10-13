export async function testTeamOfficeConnection() {
  try {
    const response = await fetch('/api/teamoffice/test');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('TeamOffice connection test failed:', error);
    throw error;
  }
}

export async function getRawRangeMCID(fromDDMMYYYY_HHMM: string, toDDMMYYYY_HHMM: string, empcode = 'ALL') {
  try {
    const response = await fetch('/api/teamoffice/raw-range-mcid', {
      method: 'POST',
      headers: {
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
    console.error('getRawRangeMCID failed:', error);
    throw error;
  }
}

// New function using the IN/OUT API that provides INTime and OUTTime directly
export async function getInOutPunchData(fromDDMMYYYY: string, toDDMMYYYY: string, empcode = 'ALL') {
  try {
    const { joinApiPath } = await import('@/config/api');
    const url = joinApiPath('/api/teamoffice/inout-punch-data');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromDate: fromDDMMYYYY,
        toDate: toDDMMYYYY,
        empcode: empcode
      })
    });
    // Detect HTML fallback (e.g., 200 with index.html)
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    if (!contentType.includes('application/json')) {
      const snippet = (await response.text()).slice(0, 200);
      throw new Error(`Unexpected non-JSON response from API. Content-Type: ${contentType}. Snippet: ${snippet}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('getInOutPunchData failed:', error);
    throw error;
  }
}

// Function for getting latest records using LastRecord API
export async function getLastPunchData(empcode = 'ALL', lastRecord?: string) {
  try {
    const response = await fetch('/api/teamoffice/last-punch-data', {
      method: 'POST',
      headers: {
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
    console.error('getLastPunchData failed:', error);
    throw error;
  }
}