import * as dotenv from 'dotenv';
import * as dayjs from 'dayjs';
import { supabase } from '../integrations/supabase/client';
import { getLastPunchData } from '../services/teamOffice';
import { processAndInsertAttendanceRecordsV3 } from '../services/attendanceDataProcessorV3';

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

    const payload = await getLastPunchData(process.env.TEAMOFFICE_EMPCODE || 'ALL', lastRecord);
    // Vendor responses vary (array or {data: []}). Normalize:
    const rows: PunchRow[] = Array.isArray(payload) ? payload
                      : Array.isArray(payload?.data) ? payload.data
                      : payload?.logs || [];

    if (!rows || rows.length === 0) {
      console.log('No new records found');
      return;
    }

    console.log(`Found ${rows.length} new records`);
    
    // Debug logging to see raw API data
    console.log('Sample raw records:');
    rows.slice(0, 5).forEach((r, i) => {
      console.log(`Record ${i + 1}:`, {
        EmpCode: r.EmpCode,
        Name: r.Name,
        IO: r.IO,
        PunchDateTime: r.PunchDateTime,
        DeviceID: r.DeviceID
      });
    });

    // Group punches by employee and date to create proper day entries
    const punchGroups = new Map<string, { 
      empcode: string, 
      name: string, 
      date: string, 
      checkin?: string, 
      checkout?: string,
      checkinDevice?: string,
      checkoutDevice?: string
    }>();

    for (const r of rows) {
      const ts = parseVendorDate(r.PunchDateTime);
      if (!ts || !r.EmpCode) continue;
      
      const dateStr = ts.toLocaleDateString('en-GB'); // DD/MM/YYYY format
      const timeStr = ts.toLocaleTimeString('en-GB', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      }); // HH:MM format
      
      const key = `${r.EmpCode}_${dateStr}`;
      const io = normalizeLogType(r.IO);
      
      if (!punchGroups.has(key)) {
        punchGroups.set(key, {
          empcode: r.EmpCode,
          name: r.Name || '',
          date: dateStr
        });
      }
      
      const group = punchGroups.get(key)!;
      
      if (io === 'checkin') {
        group.checkin = timeStr;
        group.checkinDevice = String(r.DeviceID || '');
      } else if (io === 'checkout') {
        group.checkout = timeStr;
        group.checkoutDevice = String(r.DeviceID || '');
      }
    }

    // Convert grouped punches to TeamOffice format
    const teamOfficeRecords = Array.from(punchGroups.values()).map(group => {
      // Calculate work time if both check-in and check-out exist
      let workTime = '00:00';
      if (group.checkin && group.checkout) {
        const checkinTime = new Date(`2000-01-01T${group.checkin}:00`);
        const checkoutTime = new Date(`2000-01-01T${group.checkout}:00`);
        const diffMs = checkoutTime.getTime() - checkinTime.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        workTime = `${diffHours.toString().padStart(2, '0')}:${diffMinutes.toString().padStart(2, '0')}`;
      }
      
      return {
        Empcode: group.empcode,
        Name: group.name,
        DateString: group.date,
        INTime: group.checkin || '',
        OUTTime: group.checkout || '',
        WorkTime: workTime,
        Status: 'P', // Present
        Remark: `Check-in: ${group.checkinDevice || 'unknown'}, Check-out: ${group.checkoutDevice || 'unknown'}`,
        DeviceID: group.checkinDevice || group.checkoutDevice
      };
    });

    if (teamOfficeRecords.length === 0) {
      console.log('No valid records to process');
      return;
    }

    console.log(`Processing ${teamOfficeRecords.length} records with V3 processor...`);
    
    // Debug logging to see check-out times
    teamOfficeRecords.forEach(record => {
      console.log(`Record for ${record.Empcode} (${record.Name}):`, {
        date: record.DateString,
        checkin: record.INTime,
        checkout: record.OUTTime,
        workTime: record.WorkTime,
        hasCheckout: !!record.OUTTime
      });
    });
    
    // Process using V3 processor (now uses unified_attendance table)
    const result = await processAndInsertAttendanceRecordsV3(teamOfficeRecords);
    
    if (result.success) {
      console.log(`Successfully processed ${result.processed} records`);
      if (result.errors.length > 0) {
        console.warn(`Had ${result.errors.length} errors:`, result.errors);
      }
    } else {
      console.error('Processing failed:', result.errors);
    }

    // Track the max "LastRecord" field
    let maxLR = lastRecord;
    for (const r of rows) {
      if (r.LastRecord) {
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
