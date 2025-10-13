import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import * as cron from 'node-cron';

// Load environment variables first
dotenv.config();


import { runLastRecordSync } from './jobs/teamOfficeLastRecordSync';
import { backfillDay, backfillDateRange } from './jobs/teamOfficeBackfill';
import { runEmployeeSync } from './jobs/teamOfficeEmployeeSync';
import { testTeamOfficeConnection, getLastRecord, getLastRecordMCID, getInOutPunchData, getRawRange, getRawRangeMCID } from './services/teamOffice';
import { syncEmployeesFromBiometric, getAllEmployeeProfiles } from './services/employeeProfileSync';
import { supabase } from './integrations/supabase/client';
// Import createUserAPI dynamically to ensure environment variables are loaded first

const app = express();
app.use(cors());
app.use(express.json());

// Schedule incremental sync (disabled by default until credentials are set)
const every = Number(process.env.SYNC_INTERVAL_MINUTES || 3);
const enableSync = process.env.ENABLE_SYNC === 'true';

if (enableSync) {
  console.log(`Scheduling TeamOffice sync every ${every} minutes`);
  cron.default.schedule(`*/${every} * * * *`, async () => {
    try { 
      await runLastRecordSync(); 
    }
    catch (e) { 
      console.error('TeamOffice LastRecord sync failed', e); 
    }
  });
} else {
  console.log('TeamOffice sync disabled. Set ENABLE_SYNC=true to enable.');
}

// Schedule employee sync (daily at 6 AM)
cron.default.schedule('0 6 * * *', async () => {
  try {
    await runEmployeeSync();
  } catch (e) {
    console.error('Employee sync failed', e);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'MyDay backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API endpoints for manual sync and backfill
app.get('/api/sync/status', async (req, res) => {
  try {
    // TODO: attendance_sync_state table needs to be created
    const data = { last_record: null, last_sync_at: null };
    const error = null;
    
    if (error) throw error;
    
    res.json({
      success: true,
      lastRecord: data?.last_record || 'none',
      lastSyncAt: data?.last_sync_at || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/sync/run', async (req, res) => {
  try {
    await runLastRecordSync();
    res.json({ success: true, message: 'Sync completed successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed'
    });
  }
});

app.post('/api/sync/backfill', async (req, res) => {
  try {
    const { date, startDate, endDate } = req.body;
    
    if (date) {
      // Single day backfill
      const d = new Date(date);
      const dd = d.getDate().toString().padStart(2, '0');
      const mm = (d.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = d.getFullYear().toString();
      
      await backfillDay(dd, mm, yyyy);
      res.json({ success: true, message: `Backfill completed for ${date}` });
    } else if (startDate && endDate) {
      // Date range backfill
      await backfillDateRange(new Date(startDate), new Date(endDate));
      res.json({ success: true, message: `Backfill completed from ${startDate} to ${endDate}` });
    } else {
      res.status(400).json({
        success: false,
        error: 'Either date or startDate/endDate required'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Backfill failed'
    });
  }
});

app.get('/api/attendance/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate query parameters required'
      });
    }
    
    // TODO: Implement get_employee_attendance RPC function
    const data = null;
    const error = null;
    
    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch attendance'
    });
  }
});

app.get('/api/attendance/summary', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // TODO: Implement get_attendance_summary RPC function
    const data = null;
    const error = null;
    
    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch attendance summary'
    });
  }
});

// Test TeamOffice API connection
app.get('/api/test/teamoffice', async (req, res) => {
  try {
    const result = await testTeamOfficeConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'API test failed'
    });
  }
});

// Sync employees manually
app.post('/api/sync/employees', async (req, res) => {
  try {
    await runEmployeeSync();
    res.json({ success: true, message: 'Employee sync completed successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Employee sync failed'
    });
  }
});

// Biometric test endpoints
app.get('/api/test/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Health check successful',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/test/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Health check successful',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test/teamoffice', async (req, res) => {
  try {
    const result = await testTeamOfficeConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'TeamOffice test failed'
    });
  }
});

app.post('/api/test/teamoffice', async (req, res) => {
  try {
    const result = await testTeamOfficeConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'TeamOffice test failed'
    });
  }
});

app.get('/api/test/lastrecord', async (req, res) => {
  try {
    const lastRecord = req.query.lastRecord as string || '092020$0';
    const result = await getLastRecord(lastRecord);
    res.json({ 
      success: true, 
      data: result,
      message: 'LastRecord test successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'LastRecord test failed'
    });
  }
});

app.post('/api/test/lastrecord', async (req, res) => {
  try {
    const { lastRecord } = req.body;
    const result = await getLastRecord(lastRecord || '092020$0');
    res.json({ 
      success: true, 
      data: result,
      message: 'LastRecord test successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'LastRecord test failed'
    });
  }
});

app.get('/api/test/daterange', async (req, res) => {
  try {
    const fromDate = req.query.fromDate as string || '01/10/2025_00:00';
    const toDate = req.query.toDate as string || '09/10/2025_23:59';
    const result = await getRawRangeMCID(fromDate, toDate);
    res.json({ 
      success: true, 
      data: result,
      message: 'Date range test successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Date range test failed'
    });
  }
});

app.post('/api/test/daterange', async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const result = await getRawRangeMCID(fromDate, toDate);
    res.json({ 
      success: true, 
      data: result,
      message: 'Date range test successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Date range test failed'
    });
  }
});

app.get('/api/test/employees', async (req, res) => {
  try {
    // Test with a simple API call instead of employee sync
    const data = await getRawRange('09/10/2025_00:00', '09/10/2025_23:59');
    res.json({ 
      success: true, 
      message: 'Raw data test successful (employees endpoint)',
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Raw data test failed'
    });
  }
});

app.post('/api/test/employees', async (req, res) => {
  try {
    // Test with a simple API call instead of employee sync
    const data = await getRawRange('09/10/2025_00:00', '09/10/2025_23:59');
    res.json({ 
      success: true, 
      message: 'Raw data test successful (employees endpoint)',
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Raw data test failed'
    });
  }
});

// Employee management endpoints
app.get('/api/employees/sync', async (req, res) => {
  try {
    const result = await syncEmployeesFromBiometric();
    res.json({
      success: result.success,
      message: `Employee sync completed: ${result.created} created, ${result.existing} existing, ${result.errors} errors`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Employee sync failed'
    });
  }
});

app.get('/api/employees/list', async (req, res) => {
  try {
    const employees = await getAllEmployeeProfiles();
    res.json({
      success: true,
      data: employees,
      count: employees.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch employees'
    });
  }
});

// Get recent attendance logs
app.get('/api/attendance/recent', async (req, res) => {
  try {
    // TODO: attendance_logs table needs to be created
    const data = [];
    const error = null;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch recent logs'
    });
  }
});

// Create user endpoint
app.post('/api/users/create', async (req, res) => {
  try {
    const { email, password, name, team, designation, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: email, password, name' 
      });
    }

    // Dynamic import to ensure environment variables are loaded
    const { createUserAPI } = await import('./api/createUser');
    
    const result = await createUserAPI({
      email,
      password,
      name,
      team,
      designation,
      role
    });

    if (result.success) {
      return res.status(200).json({ 
        success: true, 
        userId: result.userId,
        message: 'User created successfully'
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Error in createUser API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// TeamOffice API endpoints for client-side calls
app.post('/api/teamoffice/inout-punch-data', async (req, res) => {
  try {
    const { fromDate, toDate, empcode } = req.body;
    const result = await getInOutPunchData(fromDate, toDate, empcode);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch IN/OUT punch data'
    });
  }
});

app.post('/api/teamoffice/last-punch-data', async (req, res) => {
  try {
    const { empcode, lastRecord } = req.body;
    const result = await getLastPunchData(empcode, lastRecord);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch last punch data'
    });
  }
});

app.post('/api/teamoffice/raw-range-mcid', async (req, res) => {
  try {
    const { fromDate, toDate, empcode } = req.body;
    const result = await getRawRangeMCID(fromDate, toDate, empcode);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch raw range data'
    });
  }
});

app.get('/api/teamoffice/test', async (req, res) => {
  try {
    const result = await testTeamOfficeConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'TeamOffice connection test failed'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MyDay backend running on port ${PORT} with TeamOffice sync`);
  console.log(`Sync interval: every ${every} minutes`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
