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
import { joinApiPath } from '@/config/api';

export const apiEndpoints = {
  syncStatus: joinApiPath('/api/sync/status'),
  runSync: joinApiPath('/api/sync/run'),
  backfill: joinApiPath('/api/sync/backfill'),
  attendance: (employeeId: string) => joinApiPath(`/api/attendance/${employeeId}`),
  attendanceSummary: joinApiPath('/api/attendance/summary')
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
