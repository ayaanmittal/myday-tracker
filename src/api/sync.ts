import { NextApiRequest, NextApiResponse } from 'next';
import { autoDataSync, AutoDataSync } from '@/services/autoDataSync';

// Global sync instance
let globalSyncInstance: AutoDataSync | null = null;

function getSyncInstance(): AutoDataSync {
  if (!globalSyncInstance) {
    globalSyncInstance = new AutoDataSync();
  }
  return globalSyncInstance;
}

// GET /api/sync/status
export async function getSyncStatus(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sync = getSyncInstance();
    const status = await sync.getSyncStatus();
    res.status(200).json(status);
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
}

// GET /api/sync/config
export async function getSyncConfig(req: NextApiRequest, res: NextApiResponse) {
  try {
    // In a real implementation, you'd load this from a database
    const config = {
      syncEmployees: true,
      employeeSyncInterval: '0 2 * * *',
      syncAttendance: true,
      attendanceSyncInterval: '*/15 * * * *',
      attendanceSyncMode: 'incremental',
      autoMapEmployees: true,
      autoMapThreshold: 0.8
    };
    
    res.status(200).json(config);
  } catch (error) {
    console.error('Error getting sync config:', error);
    res.status(500).json({ error: 'Failed to get sync config' });
  }
}

// PUT /api/sync/config
export async function updateSyncConfig(req: NextApiRequest, res: NextApiResponse) {
  try {
    const config = req.body;
    
    // In a real implementation, you'd save this to a database
    console.log('Updated sync config:', config);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating sync config:', error);
    res.status(500).json({ error: 'Failed to update sync config' });
  }
}

// POST /api/sync/start
export async function startSync(req: NextApiRequest, res: NextApiResponse) {
  try {
    const config = req.body;
    const sync = getSyncInstance();
    
    // Update config if provided
    if (config) {
      // In a real implementation, you'd update the sync instance config
      console.log('Starting sync with config:', config);
    }
    
    sync.start();
    res.status(200).json({ success: true, message: 'Sync started successfully' });
  } catch (error) {
    console.error('Error starting sync:', error);
    res.status(500).json({ error: 'Failed to start sync' });
  }
}

// POST /api/sync/stop
export async function stopSync(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sync = getSyncInstance();
    sync.stop();
    res.status(200).json({ success: true, message: 'Sync stopped successfully' });
  } catch (error) {
    console.error('Error stopping sync:', error);
    res.status(500).json({ error: 'Failed to stop sync' });
  }
}

// POST /api/sync/employees
export async function runEmployeeSync(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sync = getSyncInstance();
    const result = await sync.syncEmployees();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error running employee sync:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to run employee sync',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    });
  }
}

// POST /api/sync/attendance
export async function runAttendanceSync(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sync = getSyncInstance();
    const result = await sync.syncAttendance();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error running attendance sync:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to run attendance sync',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    });
  }
}

// Main handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query } = req;
  const action = query.action as string;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    switch (action) {
      case 'status':
        if (method === 'GET') {
          await getSyncStatus(req, res);
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
        break;

      case 'config':
        if (method === 'GET') {
          await getSyncConfig(req, res);
        } else if (method === 'PUT') {
          await updateSyncConfig(req, res);
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
        break;

      case 'start':
        if (method === 'POST') {
          await startSync(req, res);
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
        break;

      case 'stop':
        if (method === 'POST') {
          await stopSync(req, res);
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
        break;

      case 'employees':
        if (method === 'POST') {
          await runEmployeeSync(req, res);
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
        break;

      case 'attendance':
        if (method === 'POST') {
          await runAttendanceSync(req, res);
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
        break;

      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}






