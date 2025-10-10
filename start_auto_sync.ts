#!/usr/bin/env tsx

import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

import { autoDataSync, AutoDataSync } from './src/services/autoDataSync';

/**
 * Start Auto Data Sync Service
 * This script starts the automatic data synchronization service
 */

async function main() {
  console.log('🚀 Starting Auto Data Sync Service...\n');

  try {
    // Test TeamOffice connection first
    console.log('🔍 Testing TeamOffice connection...');
    const { testTeamOfficeConnection } = await import('./src/services/teamOffice');
    const connectionTest = await testTeamOfficeConnection();
    
    if (!connectionTest.success) {
      console.error('❌ TeamOffice connection failed:', connectionTest.error);
      console.log('\n💡 Please check your TeamOffice API configuration:');
      console.log('   - TEAMOFFICE_BASE');
      console.log('   - TEAMOFFICE_CORP_ID');
      console.log('   - TEAMOFFICE_USERNAME');
      console.log('   - TEAMOFFICE_PASSWORD');
      process.exit(1);
    }
    
    console.log('✅ TeamOffice connection successful\n');

    // Configure sync settings
    const config = {
      syncEmployees: true,
      employeeSyncInterval: '0 2 * * *', // Daily at 2 AM
      syncAttendance: true,
      attendanceSyncInterval: '*/15 * * * *', // Every 15 minutes
      attendanceSyncMode: 'incremental' as const,
      autoMapEmployees: true,
      autoMapThreshold: 0.8,
      maxRetries: 3,
      retryDelay: 5000
    };

    console.log('⚙️  Sync Configuration:');
    console.log(`   Employee Sync: ${config.syncEmployees ? 'Enabled' : 'Disabled'} (${config.employeeSyncInterval})`);
    console.log(`   Attendance Sync: ${config.syncAttendance ? 'Enabled' : 'Disabled'} (${config.attendanceSyncInterval})`);
    console.log(`   Sync Mode: ${config.attendanceSyncMode}`);
    console.log(`   Auto-mapping: ${config.autoMapEmployees ? 'Enabled' : 'Disabled'} (${(config.autoMapThreshold * 100).toFixed(0)}% threshold)`);
    console.log('');

    // Create and start sync instance
    const sync = new AutoDataSync(config);
    sync.start();

    // Run initial sync
    console.log('🔄 Running initial sync...');
    
    if (config.syncEmployees) {
      console.log('👥 Syncing employees...');
      const employeeResult = await sync.syncEmployees();
      console.log(`   Result: ${employeeResult.success ? 'Success' : 'Failed'}`);
      console.log(`   Employees fetched: ${employeeResult.employeesFetched}`);
      console.log(`   Employees synced: ${employeeResult.employeesSynced}`);
      console.log(`   Mappings created: ${employeeResult.mappingsCreated}`);
      if (employeeResult.errors.length > 0) {
        console.log(`   Errors: ${employeeResult.errors.join(', ')}`);
      }
    }

    if (config.syncAttendance) {
      console.log('⏰ Syncing attendance...');
      const attendanceResult = await sync.syncAttendance();
      console.log(`   Result: ${attendanceResult.success ? 'Success' : 'Failed'}`);
      console.log(`   Records processed: ${attendanceResult.recordsProcessed}`);
      console.log(`   Records inserted: ${attendanceResult.recordsInserted}`);
      if (attendanceResult.errors.length > 0) {
        console.log(`   Errors: ${attendanceResult.errors.join(', ')}`);
      }
    }

    console.log('\n✅ Auto Data Sync Service started successfully!');
    console.log('📊 Sync Status:');
    
    const status = await sync.getSyncStatus();
    console.log(`   Running: ${status.isRunning ? 'Yes' : 'No'}`);
    console.log(`   Total Employees: ${status.totalEmployees}`);
    console.log(`   Total Mappings: ${status.totalMappings}`);
    console.log(`   Attendance Records (30 days): ${status.totalAttendanceRecords}`);
    
    if (status.lastAttendanceSync) {
      console.log(`   Last Attendance Sync: ${new Date(status.lastAttendanceSync).toLocaleString()}`);
    }

    console.log('\n🔄 Service is now running in the background...');
    console.log('Press Ctrl+C to stop the service');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down Auto Data Sync Service...');
      sync.stop();
      console.log('✅ Service stopped successfully');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down Auto Data Sync Service...');
      sync.stop();
      console.log('✅ Service stopped successfully');
      process.exit(0);
    });

    // Keep the process alive
    setInterval(() => {
      // Heartbeat - you could add health checks here
    }, 60000); // Every minute

  } catch (error) {
    console.error('❌ Failed to start Auto Data Sync Service:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);
