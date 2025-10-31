import { supabase } from '../integrations/supabase/client';
import { downloadInOutByRange } from '../services/teamOffice';

type Row = {
  EmpCode?: string;
  Name?: string;
  IO?: string;              // "IN"/"OUT"
  PunchDateTime?: string;   // dd/MM/yyyy_HH:mm
  DeviceID?: string | number;
};

function normalize(io?: string) {
  const t = (io||'').toLowerCase();
  if (t.includes('in')) return 'checkin';
  if (t.includes('out')) return 'checkout';
  return 'unknown';
}

function parseDDMMYYYY_HHMM(s: string): Date {
  const [dmy, hm] = s.split('_');
  const [d,m,y] = dmy.split('/');
  return new Date(`${y}-${m}-${d} ${hm}:00`);
}

export async function backfillDay(dd: string, mm: string, yyyy: string) {
  try {
    console.log(`Starting backfill for ${dd}/${mm}/${yyyy}...`);
    
    const from = `${dd}/${mm}/${yyyy}_00:00`;
    const to   = `${dd}/${mm}/${yyyy}_23:59`;

    const payload = await downloadInOutByRange(from, to, process.env.TEAMOFFICE_EMPCODE);
    const rows: Row[] = Array.isArray(payload) ? payload
                      : Array.isArray(payload?.data) ? payload.data
                      : payload?.logs || [];

    console.log(`Found ${rows.length} records for ${dd}/${mm}/${yyyy}`);

    for (const r of rows) {
      const ts = parseDDMMYYYY_HHMM(r.PunchDateTime || `${dd}/${mm}/${yyyy}_00:00`);
      
      const { error } = await supabase
        .from('attendance_logs')
        .insert({
          employee_id: r.EmpCode || '',
          employee_name: r.Name || null,
          log_time: ts.toISOString(),
          log_type: normalize(r.IO),
          device_id: String(r.DeviceID || ''),
          source: 'teamoffice',
          raw_payload: r
        });

      if (error && !error.message.includes('duplicate key')) {
        console.error('Error inserting backfill record:', error);
      }
    }
    
    console.log(`Backfill completed for ${dd}/${mm}/${yyyy}`);
  } catch (error) {
    console.error(`Backfill failed for ${dd}/${mm}/${yyyy}:`, error);
    throw error;
  }
}

export async function backfillDateRange(startDate: Date, endDate: Date) {
  console.log(`Starting backfill from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dd = current.getDate().toString().padStart(2, '0');
    const mm = (current.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = current.getFullYear().toString();
    
    await backfillDay(dd, mm, yyyy);
    
    // Move to next day
    current.setDate(current.getDate() + 1);
  }
  
  console.log('Date range backfill completed');
}
