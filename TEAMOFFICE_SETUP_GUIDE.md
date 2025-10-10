# TeamOffice Integration Setup Guide

## ✅ **Issues Fixed**

1. **localStorage Error**: Fixed Node.js compatibility issue in Supabase client
2. **API Authentication**: Confirmed correct authentication format
3. **Environment Variables**: Added dotenv configuration to all scripts

## 🔧 **Current Status**

- ✅ **API Connection**: Working with test credentials (confirmed via debug output)
- ✅ **Database Schema**: All tables created and ready
- ✅ **Sync Jobs**: Employee and attendance sync jobs ready
- ✅ **UI Components**: Employee mapping interface ready
- ⚠️ **Test Credentials**: Limited access (500 errors on some endpoints)

## 🚀 **Production Setup**

### 1. **Environment Configuration**

Create a `.env` file in your project root:

```env
# TeamOffice API Configuration
TEAMOFFICE_BASE=https://api.etimeoffice.com/api
TEAMOFFICE_CORP_ID=yourActualCorporateId
TEAMOFFICE_USERNAME=yourActualUsername
TEAMOFFICE_PASSWORD=yourActualPassword
TEAMOFFICE_TRUE_LITERAL=true
TEAMOFFICE_EMPCODE=ALL

# Sync Configuration
SYNC_INTERVAL_MINUTES=3
TIMEZONE=Asia/Kolkata
PORT=3000

# Supabase (if different from default)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. **Database Setup**

Run the database migrations in order:

```bash
# 1. Attendance logs and sync state
psql -h your-db-host -U your-username -d your-database -f supabase/migrations/20250109000003_create_attendance_logs.sql

# 2. Employee mapping tables
psql -h your-db-host -U your-username -d your-database -f supabase/migrations/20250109000004_create_employee_mapping.sql
```

### 3. **Testing Your Credentials**

```bash
# Test API connection with your credentials
npm run test-api-working

# Test employee sync
npm run sync-employees

# Test attendance sync
npm run sync
```

### 4. **Start the System**

```bash
# Start the backend server
npm run server:dev

# In another terminal, start the frontend
npm run dev
```

## 📊 **API Endpoints Available**

### **Backend API Endpoints:**
- `GET /api/sync/status` - Check sync status
- `POST /api/sync/attendance` - Manual attendance sync
- `POST /api/sync/employees` - Manual employee sync
- `GET /api/test/teamoffice` - Test API connection
- `GET /api/attendance/summary?date=YYYY-MM-DD` - Get attendance summary

### **Frontend Routes:**
- `/` - Dashboard
- `/today` - Today's attendance (includes biometric data)
- `/history` - Personal attendance history
- `/employees` - Employee management (admin)
- `/leave` - Leave application
- `/leave-approval` - Leave approval (admin)
- `/reports` - Analytics and reports (admin)

## 🔄 **Sync Process**

### **Automatic Sync:**
1. **Attendance Sync**: Every 3 minutes (configurable)
2. **Employee Sync**: Daily at 6 AM

### **Manual Sync:**
```bash
# Sync attendance data
npm run sync

# Sync employee data
npm run sync-employees

# Test API connection
npm run test-api-working
```

## 🗂️ **Data Flow**

1. **TeamOffice API** → **Backend Sync Jobs** → **Database**
2. **Database** → **Frontend UI** → **User Display**
3. **Employee Mapping** → **Linked Attendance Data**

## 🛠️ **Troubleshooting**

### **Common Issues:**

1. **500 API Errors**: 
   - Check your credentials
   - Verify corporate ID
   - Check API rate limits

2. **localStorage Errors**:
   - Fixed in latest version
   - Ensure you're using the updated client

3. **Database Connection**:
   - Check Supabase credentials
   - Verify RLS policies
   - Check table permissions

### **Debug Commands:**

```bash
# Test API with detailed output
npm run debug-api

# Test specific API endpoints
npm run test-api-working

# Check server logs
npm run server:dev
```

## 📈 **Monitoring**

### **Check Sync Status:**
```bash
curl http://localhost:3000/api/sync/status
```

### **View Logs:**
- Backend logs: Console output from `npm run server:dev`
- Database logs: Supabase dashboard
- API logs: Check network tab in browser

## 🎯 **Next Steps**

1. **Set up your real TeamOffice credentials**
2. **Test the API connection**
3. **Run employee sync to populate mapping data**
4. **Configure employee mappings in the UI**
5. **Start automatic attendance sync**

## 📞 **Support**

If you encounter issues:
1. Check the logs for specific error messages
2. Verify your API credentials with TeamOffice support
3. Test individual components using the debug scripts
4. Review the database schema and permissions

The system is now ready for production use with your actual TeamOffice credentials! 🎉
