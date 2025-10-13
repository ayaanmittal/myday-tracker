import * as cron from 'node-cron';
import { supabaseService } from '@/integrations/supabase/service';
import { 
  getLastRecordMCID, 
  getInOutPunchData, 
  getRawRangeMCID,
  testTeamOfficeConnection 
} from './teamOffice';
import { processAndInsertAttendanceRecords } from './attendanceDataProcessor';
import { processBulkEmployeeMapping } from './bulkEmployeeMapping';
import { fetchTeamOfficeEmployees, syncTeamOfficeEmployees } from './teamOfficeEmployees';

export interface SyncConfig {
  // Employee sync settings
  syncEmployees: boolean;
  employeeSyncInterval: string; // cron expression
  
  // Attendance sync settings
  syncAttendance: boolean;
  attendanceSyncInterval: string; // cron expression
  attendanceSyncMode: 'incremental' | 'daily' | 'range';
  
  // Auto-mapping settings
  autoMapEmployees: boolean;
  autoMapThreshold: number;
  
  // Error handling
  maxRetries: number;
  retryDelay: number; // milliseconds
}

const DEFAULT_CONFIG: SyncConfig = {
  syncEmployees: true,
  employeeSyncInterval: '0 2 * * *', // Daily at 2 AM
  syncAttendance: true,
  attendanceSyncInterval: '*/15 * * * *', // Every 15 minutes
  attendanceSyncMode: 'incremental',
  autoMapEmployees: true,
  autoMapThreshold: 0.8,
  maxRetries: 3,
  retryDelay: 5000
};

class AutoDataSync {
  private config: SyncConfig;
  private isRunning = false;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start all scheduled sync jobs
   */
  start(): void {
    console.log('🚀 Starting Auto Data Sync...');
    console.log('Config:', this.config);

    if (this.config.syncEmployees) {
      this.scheduleEmployeeSync();
    }

    if (this.config.syncAttendance) {
      this.scheduleAttendanceSync();
    }

    console.log('✅ Auto Data Sync started successfully');
  }

  /**
   * Stop all scheduled sync jobs
   */
  stop(): void {
    console.log('🛑 Stopping Auto Data Sync...');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped job: ${name}`);
    });
    
    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Auto Data Sync stopped');
  }

  /**
   * Schedule employee sync job
   */
  private scheduleEmployeeSync(): void {
    const job = cron.schedule(this.config.employeeSyncInterval, async () => {
      console.log('🔄 Running scheduled employee sync...');
      await this.syncEmployees();
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.jobs.set('employeeSync', job);
    job.start();
    console.log(`📅 Employee sync scheduled: ${this.config.employeeSyncInterval}`);
  }

  /**
   * Schedule attendance sync job
   */
  private scheduleAttendanceSync(): void {
    const job = cron.schedule(this.config.attendanceSyncInterval, async () => {
      console.log('🔄 Running scheduled attendance sync...');
      await this.syncAttendance();
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.jobs.set('attendanceSync', job);
    job.start();
    console.log(`📅 Attendance sync scheduled: ${this.config.attendanceSyncInterval}`);
  }

  /**
   * Sync employees from TeamOffice
   */
  async syncEmployees(): Promise<{
    success: boolean;
    employeesFetched: number;
    employeesSynced: number;
    mappingsCreated: number;
    errors: string[];
  }> {
    const result = {
      success: true,
      employeesFetched: 0,
      employeesSynced: 0,
      mappingsCreated: 0,
      errors: [] as string[]
    };

    try {
      console.log('👥 Starting employee sync...');

      // Test connection first
      const connectionTest = await testTeamOfficeConnection();
      if (!connectionTest.success) {
        throw new Error(`Connection test failed: ${connectionTest.error}`);
      }

      // Fetch employees from TeamOffice API
      const employees = await fetchTeamOfficeEmployees();
      result.employeesFetched = employees.length;
      console.log(`📥 Fetched ${employees.length} employees from TeamOffice`);

      // Sync employees to database
      const syncedCount = await syncTeamOfficeEmployees(employees);
      result.employeesSynced = syncedCount;
      console.log(`💾 Synced ${syncedCount} employees to database`);

      // Auto-map employees if enabled
      if (this.config.autoMapEmployees) {
        console.log('🔗 Running auto-mapping...');
        const mappingResult = await processBulkEmployeeMapping({
          minMatchScore: 0.3,
          autoMapThreshold: this.config.autoMapThreshold,
          createMissingUsers: false
        });
        
        result.mappingsCreated = mappingResult.autoMapped;
        console.log(`🔗 Auto-mapped ${mappingResult.autoMapped} employees`);
        
        if (mappingResult.manualReview > 0) {
          console.log(`⚠️  ${mappingResult.manualReview} employees need manual review`);
        }
      }

      console.log('✅ Employee sync completed successfully');

    } catch (error) {
      const errorMsg = `Employee sync failed: ${error}`;
      console.error('❌', errorMsg);
      result.success = false;
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Sync attendance data from TeamOffice
   */
  async syncAttendance(): Promise<{
    success: boolean;
    recordsProcessed: number;
    recordsInserted: number;
    errors: string[];
  }> {
    const result = {
      success: true,
      recordsProcessed: 0,
      recordsInserted: 0,
      errors: [] as string[]
    };

    try {
      console.log('⏰ Starting attendance sync...');

      // Test connection first
      const connectionTest = await testTeamOfficeConnection();
      if (!connectionTest.success) {
        throw new Error(`Connection test failed: ${connectionTest.error}`);
      }

      let attendanceData: any[] = [];

      if (this.config.attendanceSyncMode === 'incremental') {
        // Use incremental sync with LastRecord
        attendanceData = await this.syncIncrementalAttendance();
      } else if (this.config.attendanceSyncMode === 'daily') {
        // Sync today's data
        attendanceData = await this.syncDailyAttendance();
      } else if (this.config.attendanceSyncMode === 'range') {
        // Sync specific date range
        attendanceData = await this.syncRangeAttendance();
      }

      result.recordsProcessed = attendanceData.length;
      console.log(`📥 Fetched ${attendanceData.length} attendance records`);

      if (attendanceData.length > 0) {
        // Process and insert attendance records
        const processResult = await processAndInsertAttendanceRecords(attendanceData);
        result.recordsInserted = processResult.processed;
        
        if (processResult.errors > 0) {
          result.errors.push(...processResult.errorDetails);
        }

        console.log(`💾 Processed ${processResult.processed} attendance records`);
        if (processResult.errors > 0) {
          console.log(`⚠️  ${processResult.errors} records had errors`);
        }
      }

      console.log('✅ Attendance sync completed successfully');

    } catch (error) {
      const errorMsg = `Attendance sync failed: ${error}`;
      console.error('❌', errorMsg);
      result.success = false;
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Incremental attendance sync using LastRecord
   */
  private async syncIncrementalAttendance(): Promise<any[]> {
    try {
      // Get last sync state
      const { data: syncState } = await supabaseService
        .from('attendance_sync_state')
        .select('last_record')
        .eq('id', 1)
        .single();

      const lastRecord = syncState?.last_record || '';
      console.log(`📊 Last record: ${lastRecord || 'none (first sync)'}`);

      // Fetch new records
      const response = await getLastRecordMCID(lastRecord, 'ALL');
      const records = Array.isArray(response) ? response : response?.data || [];

      if (records.length > 0) {
        // Update sync state
        const maxRecord = this.findMaxLastRecord(records);
        if (maxRecord && maxRecord !== lastRecord) {
          await supabaseService
            .from('attendance_sync_state')
            .update({ 
              last_record: maxRecord,
              last_sync_at: new Date().toISOString()
            })
            .eq('id', 1);
          
          console.log(`📊 Updated last record to: ${maxRecord}`);
        }
      }

      return records;
    } catch (error) {
      console.error('Error in incremental sync:', error);
      throw error;
    }
  }

  /**
   * Daily attendance sync
   */
  private async syncDailyAttendance(): Promise<any[]> {
    const today = new Date();
    const fromDate = this.formatDateForAPI(today) + '_00:00';
    const toDate = this.formatDateForAPI(today) + '_23:59';

    console.log(`📅 Syncing data for ${fromDate} to ${toDate}`);

    const response = await getRawRangeMCID(fromDate, toDate, 'ALL');
    return Array.isArray(response) ? response : response?.data || [];
  }

  /**
   * Range attendance sync
   */
  private async syncRangeAttendance(): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days

    const fromDate = this.formatDateForAPI(startDate) + '_00:00';
    const toDate = this.formatDateForAPI(endDate) + '_23:59';

    console.log(`📅 Syncing data for ${fromDate} to ${toDate}`);

    const response = await getRawRangeMCID(fromDate, toDate, 'ALL');
    return Array.isArray(response) ? response : response?.data || [];
  }

  /**
   * Find the maximum LastRecord value from records
   */
  private findMaxLastRecord(records: any[]): string | null {
    let maxRecord = '';
    
    for (const record of records) {
      if (record.LastRecord) {
        // Parse LastRecord format: MMyyyy$ID
        const [, , idStr] = record.LastRecord.match(/^(\d{2})(\d{4})\$(\d+)$/) || [];
        const [, , maxIdStr] = maxRecord.match(/^(\d{2})(\d{4})\$(\d+)$/) || [];
        
        const id = Number(idStr || '0');
        const maxId = Number(maxIdStr || '0');
        
        if (id > maxId) {
          maxRecord = record.LastRecord;
        }
      }
    }
    
    return maxRecord || null;
  }

  /**
   * Format date for TeamOffice API (DD/MM/YYYY format)
   */
  private formatDateForAPI(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Get sync status and statistics
   */
  async getSyncStatus(): Promise<{
    isRunning: boolean;
    lastEmployeeSync?: string;
    lastAttendanceSync?: string;
    totalEmployees: number;
    totalMappings: number;
    totalAttendanceRecords: number;
  }> {
    try {
      // Get last sync times
      const { data: syncState } = await supabaseService
        .from('attendance_sync_state')
        .select('last_sync_at')
        .eq('id', 1)
        .single();

      // Get employee count
      const { count: employeeCount } = await supabaseService
        .from('teamoffice_employees')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get mapping count
      const { count: mappingCount } = await supabaseService
        .from('employee_mappings')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get attendance records count (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: attendanceCount } = await supabaseService
        .from('attendance_logs')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'teamoffice')
        .gte('log_time', thirtyDaysAgo.toISOString());

      return {
        isRunning: this.isRunning,
        lastAttendanceSync: syncState?.last_sync_at,
        totalEmployees: employeeCount || 0,
        totalMappings: mappingCount || 0,
        totalAttendanceRecords: attendanceCount || 0
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        isRunning: this.isRunning,
        totalEmployees: 0,
        totalMappings: 0,
        totalAttendanceRecords: 0
      };
    }
  }
}

// Export singleton instance
export const autoDataSync = new AutoDataSync();

// Export for manual configuration
export { AutoDataSync, DEFAULT_CONFIG };



