import * as dotenv from 'dotenv';
import * as dayjs from 'dayjs';
import { supabase } from '../integrations/supabase/client';
import { downloadLastPunchData } from '../services/teamOffice';
import { getEmployeeMapping } from '../services/teamOfficeEmployees';

// Load environment variables
dotenv.config();

type PunchRow = {
  EmpCode?: string;
  Name?: string;
  IO?: string;             // "IN" / "OUT" or variants
  PunchDateTime?: string;  // e.g. "09/10/2025_14:22" or "09/10/2025 14:22:10"
  DeviceID?: string | number;
  LastRecord?: string;     // "MMyyyy$ID" per vendor
};

function normalizeLogType(io?: string) {
  const t = (io||'').toLowerCase();
  if (t.includes('in')) return 'checkin';
  if (t.includes('out')) return 'checkout';
  return 'unknown';
}

function parseVendorDate(s?: string): Date | null {
  if (!s) return null;
  // Accept both "dd/MM/yyyy_HH:mm" and "dd/MM/yyyy HH:mm:ss"
  const ss = s.replace('_', ' ');
  const [d, m, yAndRest] = ss.split('/');
  if (!d || !m || !yAndRest) return null;
  // yAndRest like "2025 14:22:10" or "2025 14:22"
  const [yyyy, time] = yAndRest.split(' ');
  const ts = `${yyyy}-${m}-${d} ${time || '00:00'}`;
  return new Date(ts);
}

async function getLastRecord(): Promise<string> {
  const { data, error } = await supabase
    .from('attendance_sync_state')
    .select('last_record')
    .eq('id', 1)
    .single();
  
  if (error) {
    console.error('Error getting last record:', error);
    return '';
  }
  
  return data?.last_record || '';  // empty means "first time"
}

async function setLastRecord(lr: string) {
  const { error } = await supabase
    .from('attendance_sync_state')
    .update({ 
      last_record: lr, 
      last_sync_at: new Date().toISOString() 
    })
    .eq('id', 1);
    
  if (error) {
    console.error('Error setting last record:', error);
  }
}

export async function runLastRecordSync() {
  try {
    console.log('Starting TeamOffice LastRecord sync...');
    
    // First call needs a seed like 'MMyyyy$ID'. If empty, default to current month with ID 0.
    let lastRecord = await getLastRecord();
    if (!lastRecord) {
  const mm = dayjs.default().format('MM');
  const yyyy = dayjs.default().format('YYYY');
      lastRecord = `${mm}${yyyy}$0`;
      console.log('No last record found, using:', lastRecord);
    }

    const payload = await downloadLastPunchData(lastRecord, process.env.TEAMOFFICE_EMPCODE);
    // Vendor responses vary (array or {data: []}). Normalize:
    const rows: PunchRow[] = Array.isArray(payload) ? payload
                      : Array.isArray(payload?.data) ? payload.data
                      : payload?.logs || [];

    if (!rows || rows.length === 0) {
      console.log('No new records found');
      return;
    }

    console.log(`Found ${rows.length} new records`);

    // Insert rows + track max LastRecord seen
    let maxLR = lastRecord;

  for (const r of rows) {
    const ts = parseVendorDate(r.PunchDateTime);
    if (!ts) {
      console.warn('Skipping invalid date:', r.PunchDateTime);
      continue;
    }

    const io = normalizeLogType(r.IO);
    
    // Get employee mapping to find our user ID
    let ourUserId = r.EmpCode || '';
    let ourUserName = r.Name || null;
    
    if (r.EmpCode) {
      try {
        const mapping = await getEmployeeMapping(r.EmpCode);
        if (mapping) {
          ourUserId = mapping.our_user_id;
          ourUserName = mapping.our_name || mapping.teamoffice_name;
          console.log(`Mapped TeamOffice employee ${r.EmpCode} to our user ${ourUserId}`);
        } else {
          console.warn(`No mapping found for TeamOffice employee ${r.EmpCode}, using original data`);
        }
      } catch (error) {
        console.error(`Error getting mapping for employee ${r.EmpCode}:`, error);
        // Continue with original data if mapping fails
      }
    }
    
    const { error } = await supabase
      .from('attendance_logs')
      .insert({
        employee_id: ourUserId,
        employee_name: ourUserName,
        log_time: ts.toISOString(),
        log_type: io,
        device_id: String(r.DeviceID || ''),
        source: 'teamoffice',
        raw_payload: r
      });

    if (error && !error.message.includes('duplicate key')) {
      console.error('Error inserting attendance log:', error);
    }

      // Track the max "LastRecord" field
      if (r.LastRecord) {
        // lexical compare is ok because vendor encodes MMyyyy$ID; we'll split + numeric compare
        const [, , idStr] = r.LastRecord.match(/^(\d{2})(\d{4})\$(\d+)$/) || [];
        const [, , idStrMax] = maxLR.match(/^(\d{2})(\d{4})\$(\d+)$/) || [];
        const id = Number(idStr || '0');
        const idMax = Number(idStrMax || '0');
        if (id > idMax) maxLR = r.LastRecord;
      }
    }

    if (maxLR !== lastRecord) {
      await setLastRecord(maxLR);
      console.log('Updated last record to:', maxLR);
    }
    
    console.log('TeamOffice LastRecord sync completed successfully');
  } catch (error) {
    console.error('TeamOffice LastRecord sync failed:', error);
    throw error;
  }
}
