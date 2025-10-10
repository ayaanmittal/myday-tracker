# Auto Data Sync Guide

This guide explains how to set up and use the automatic data synchronization system for fetching data from the TeamOffice API.

## 🚀 Quick Start

### 1. Setup
```bash
# Run the setup script
chmod +x setup_auto_sync.sh
./setup_auto_sync.sh

# Update your .env file with API credentials
# Then start the service
npx tsx start_auto_sync.ts
```

### 2. Manual Sync
```bash
# Run bulk employee mapping
npx tsx run_bulk_mapping.ts

# Run custom mapping configuration
npx tsx run_bulk_mapping.ts custom
```

## 📋 Features

### ✅ Automatic Employee Sync
- **Frequency**: Daily at 2 AM (configurable)
- **Actions**: Fetches employee data from TeamOffice API
- **Auto-mapping**: Creates user mappings for high-confidence matches
- **Database**: Stores in `teamoffice_employees` and `employee_mappings` tables

### ✅ Automatic Attendance Sync
- **Frequency**: Every 15 minutes (configurable)
- **Modes**: 
  - **Incremental**: Uses LastRecord for efficient sync
  - **Daily**: Syncs today's data
  - **Range**: Syncs last 7 days
- **Database**: Stores in `attendance_logs` and `day_entries` tables

### ✅ Smart Matching
- **Name similarity**: Fuzzy matching for employee names
- **Email matching**: Exact email comparison
- **Auto-mapping**: Configurable confidence threshold (default 80%)
- **Manual review**: Medium confidence matches require approval

## ⚙️ Configuration

### Sync Intervals
```typescript
const config = {
  // Employee sync (cron expression)
  employeeSyncInterval: '0 2 * * *',        // Daily at 2 AM
  employeeSyncInterval: '0 2 * * 1',        // Weekly on Monday
  employeeSyncInterval: '0 2 */3 * *',      // Every 3 days
  
  // Attendance sync (cron expression)
  attendanceSyncInterval: '*/15 * * * *',   // Every 15 minutes
  attendanceSyncInterval: '*/30 * * * *',   // Every 30 minutes
  attendanceSyncInterval: '0 * * * *',      // Every hour
  attendanceSyncInterval: '0 */2 * * *',    // Every 2 hours
};
```

### Sync Modes
- **Incremental**: Most efficient, uses LastRecord API
- **Daily**: Syncs current day's data
- **Range**: Syncs last 7 days (useful for backfill)

### Auto-mapping Settings
- **Threshold**: 0.5-1.0 (50%-100% confidence required)
- **Create Users**: Automatically create users for unmapped employees
- **Manual Review**: Medium confidence matches require approval

## 🎛️ Admin Interface

### AutoSyncManager Component
```tsx
import { AutoSyncManager } from '@/pages/AutoSyncManager';

// Add to your admin page
<AutoSyncManager />
```

**Features:**
- Start/stop sync service
- Manual sync triggers
- Real-time status monitoring
- Configuration management
- Sync history and logs

## 📊 Monitoring

### Sync Status
```typescript
const status = await autoDataSync.getSyncStatus();
console.log({
  isRunning: status.isRunning,
  totalEmployees: status.totalEmployees,
  totalMappings: status.totalMappings,
  totalAttendanceRecords: status.totalAttendanceRecords,
  lastSync: status.lastAttendanceSync
});
```

### Health Checks
- **Connection Test**: Validates TeamOffice API connectivity
- **Data Validation**: Ensures data integrity
- **Error Handling**: Comprehensive error logging and retry logic

## 🔧 API Endpoints

### Sync Management
```bash
# Get sync status
GET /api/sync/status

# Start sync service
POST /api/sync/start

# Stop sync service
POST /api/sync/stop

# Run employee sync manually
POST /api/sync/employees

# Run attendance sync manually
POST /api/sync/attendance
```

### Configuration
```bash
# Get current configuration
GET /api/sync/config

# Update configuration
PUT /api/sync/config
```

## 📝 Database Schema

### Tables Used
- **`teamoffice_employees`**: TeamOffice employee data
- **`employee_mappings`**: Links TeamOffice employees to your users
- **`attendance_logs`**: Individual check-in/check-out records
- **`day_entries`**: Daily work summaries
- **`attendance_sync_state`**: Tracks incremental sync progress

### Data Flow
1. **Employee Sync**: TeamOffice API → `teamoffice_employees` → `employee_mappings`
2. **Attendance Sync**: TeamOffice API → `attendance_logs` + `day_entries`

## 🚨 Troubleshooting

### Common Issues

#### Connection Errors
```bash
# Test TeamOffice connection
npx tsx -e "
import { testTeamOfficeConnection } from './src/services/teamOffice';
testTeamOfficeConnection().then(console.log);
"
```

**Solutions:**
- Check API credentials in `.env`
- Verify network connectivity
- Confirm API endpoint availability

#### Mapping Issues
```bash
# Check unmapped employees
npx tsx run_bulk_mapping.ts unmapped
```

**Solutions:**
- Run bulk mapping with lower threshold
- Manually approve suggested matches
- Check name variations and typos

#### Sync Failures
```bash
# Check sync logs
tail -f logs/auto_sync.log
```

**Solutions:**
- Verify database connectivity
- Check Supabase permissions
- Review error messages in logs

### Debug Mode
```typescript
// Enable debug logging
const sync = new AutoDataSync({
  ...config,
  debug: true
});
```

## 📈 Performance

### Optimization Tips
- **Incremental Sync**: Use for production (most efficient)
- **Batch Processing**: Processes multiple records at once
- **Error Handling**: Automatic retry with exponential backoff
- **Connection Pooling**: Reuses API connections

### Monitoring
- **Sync Frequency**: Adjust based on data volume
- **Error Rates**: Monitor and alert on high error rates
- **Data Volume**: Track records processed per sync
- **Performance**: Monitor sync duration and resource usage

## 🔒 Security

### API Security
- **Environment Variables**: Store credentials securely
- **Rate Limiting**: Respects API rate limits
- **Error Handling**: Doesn't expose sensitive data in logs

### Data Privacy
- **Minimal Data**: Only syncs necessary fields
- **Secure Storage**: Uses Supabase RLS policies
- **Audit Trail**: Tracks all sync operations

## 📚 Examples

### Custom Sync Configuration
```typescript
import { AutoDataSync } from './src/services/autoDataSync';

const customSync = new AutoDataSync({
  syncEmployees: true,
  employeeSyncInterval: '0 1 * * *', // 1 AM daily
  syncAttendance: true,
  attendanceSyncInterval: '*/10 * * * *', // Every 10 minutes
  attendanceSyncMode: 'incremental',
  autoMapEmployees: true,
  autoMapThreshold: 0.9, // 90% confidence
  createMissingUsers: false,
  maxRetries: 5,
  retryDelay: 10000
});

customSync.start();
```

### Manual Data Processing
```typescript
import { processAndInsertAttendanceRecords } from './src/services/attendanceDataProcessor';

const records = [
  {
    "Empcode": "0006",
    "INTime": "10:20",
    "OUTTime": "17:12",
    "WorkTime": "06:52",
    "Status": "P",
    "DateString": "08/10/2025",
    "Name": "Sakshi"
  }
];

const result = await processAndInsertAttendanceRecords(records);
console.log(`Processed: ${result.processed}, Errors: ${result.errors}`);
```

## 🆘 Support

### Getting Help
1. Check the troubleshooting section above
2. Review console logs for detailed error messages
3. Verify API credentials and network connectivity
4. Test with manual sync commands first

### Logs
- **Console Output**: Real-time sync status
- **Error Logs**: Detailed error information
- **Sync History**: Track sync operations and results

---

**Happy Syncing! 🎉**


