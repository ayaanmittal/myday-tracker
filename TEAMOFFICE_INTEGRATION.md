# TeamOffice Biometric Integration

This integration adds automated sync from TeamOffice biometric devices while keeping your existing manual check-in/out functionality intact.

## Features

- ✅ **Dual Data Sources**: Manual check-ins and biometric device data
- ✅ **Real-time Sync**: Incremental sync every 3 minutes (configurable)
- ✅ **Historical Backfill**: Import past attendance data
- ✅ **Unified UI**: Combined view of manual and biometric logs
- ✅ **Deduplication**: Prevents duplicate entries
- ✅ **Timezone Support**: Asia/Kolkata timezone handling

## Setup Instructions

### 1. Environment Configuration

Create a `.env` file in your project root with your TeamOffice API credentials:

```env
# TeamOffice API
TEAMOFFICE_BASE=https://api.etimeoffice.com/api
TEAMOFFICE_CORP_ID=yourCorporateId
TEAMOFFICE_USERNAME=yourUsername
TEAMOFFICE_PASSWORD=yourPassword
TEAMOFFICE_TRUE_LITERAL=true

# Optional filters
TEAMOFFICE_EMPCODE=ALL          # or specific emp code like 0001

# Sync cadence
SYNC_INTERVAL_MINUTES=3

# App
TIMEZONE=Asia/Kolkata
PORT=3000
```

### 2. Database Migration

Run the database migration to create the required tables:

```sql
-- This will be automatically applied when you run the migration
-- Creates attendance_logs and attendance_sync_state tables
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Backend Server

```bash
# Development mode with auto-reload
npm run server:dev

# Production mode
npm run server
```

### 5. Start the Frontend

```bash
# In a separate terminal
npm run dev
```

## API Endpoints

### Sync Management
- `GET /api/sync/status` - Get sync status and last record
- `POST /api/sync/run` - Manually trigger sync
- `POST /api/sync/backfill` - Backfill historical data

### Attendance Data
- `GET /api/attendance/:employeeId` - Get employee attendance logs
- `GET /api/attendance/summary` - Get attendance summary for a date

## Usage Examples

### Manual Sync Trigger
```bash
curl -X POST http://localhost:3000/api/sync/run
```

### Backfill Single Day
```bash
curl -X POST http://localhost:3000/api/sync/backfill \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-01-09"}'
```

### Backfill Date Range
```bash
curl -X POST http://localhost:3000/api/sync/backfill \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2025-01-01", "endDate": "2025-01-09"}'
```

## Database Schema

### attendance_logs
- `id` - Primary key
- `employee_id` - Employee identifier
- `employee_name` - Employee name
- `log_time` - Timestamp of the log
- `log_type` - 'checkin', 'checkout', or 'unknown'
- `device_id` - Device identifier
- `source` - 'manual' or 'teamoffice'
- `raw_payload` - Original API response data

### attendance_sync_state
- `id` - Always 1 (singleton)
- `last_record` - Last processed record ID
- `last_sync_at` - Last sync timestamp

## UI Integration

The `AttendanceLogs` component can be used anywhere in your app:

```tsx
import { AttendanceLogs } from '@/components/AttendanceLogs';

// Show all logs for current user
<AttendanceLogs />

// Show logs for specific employee
<AttendanceLogs employeeId="123" />

// Show logs for date range
<AttendanceLogs 
  startDate="2025-01-01" 
  endDate="2025-01-09" 
/>

// Show with summary tab
<AttendanceLogs showSummary={true} />
```

## Troubleshooting

### Sync Issues
1. Check your API credentials in `.env`
2. Verify network connectivity to TeamOffice API
3. Check server logs for error messages
4. Test API connection manually:

```bash
npm run sync
```

### Data Issues
1. Check for duplicate entries (should be prevented by unique index)
2. Verify timezone settings
3. Check date format parsing

### Performance
1. Adjust `SYNC_INTERVAL_MINUTES` for your needs
2. Monitor database size with large datasets
3. Consider archiving old logs periodically

## Security Notes

- API credentials are stored in environment variables
- Database uses Row Level Security (RLS)
- Users can only see their own attendance data
- Admins can see all data
- Raw API responses are stored for debugging

## Monitoring

The sync job runs automatically every 3 minutes. Check the server logs for:
- Successful syncs
- API errors
- Data processing issues
- Performance metrics

## Support

For issues with:
- **TeamOffice API**: Contact TeamOffice support
- **Integration**: Check this documentation and server logs
- **Database**: Check Supabase logs and RLS policies
