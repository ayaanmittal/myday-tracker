// TeamOffice API Configuration
export const teamOfficeConfig = {
  baseUrl: import.meta.env.VITE_TEAMOFFICE_BASE || 'https://api.etimeoffice.com/api',
  corpId: import.meta.env.VITE_TEAMOFFICE_CORP_ID || '',
  username: import.meta.env.VITE_TEAMOFFICE_USERNAME || '',
  password: import.meta.env.VITE_TEAMOFFICE_PASSWORD || '',
  trueLiteral: import.meta.env.VITE_TEAMOFFICE_TRUE_LITERAL || 'true',
  empCode: import.meta.env.VITE_TEAMOFFICE_EMPCODE || 'ALL',
  syncIntervalMinutes: parseInt(import.meta.env.VITE_SYNC_INTERVAL_MINUTES || '3'),
  timezone: import.meta.env.VITE_TIMEZONE || 'Asia/Kolkata'
};

// Server API endpoints
export const apiEndpoints = {
  syncStatus: '/api/sync/status',
  runSync: '/api/sync/run',
  backfill: '/api/sync/backfill',
  attendance: (employeeId: string) => `/api/attendance/${employeeId}`,
  attendanceSummary: '/api/attendance/summary'
};

// Helper function to get basic auth header
export function getBasicAuthHeader() {
  const tuple = [
    teamOfficeConfig.corpId,
    teamOfficeConfig.username,
    teamOfficeConfig.password,
    teamOfficeConfig.trueLiteral
  ].join(':');

  const b64 = btoa(tuple);
  return { Authorization: b64 };
}
