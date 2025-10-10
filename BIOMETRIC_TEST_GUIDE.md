# 🔬 Biometric API Test Page

## 🎯 **What This Does**

The Biometric Test page allows you to:
- **Test TeamOffice API** in real-time
- **See biometric data** as it's fetched
- **Monitor API responses** with detailed logs
- **Auto-refresh** to catch new biometric scans
- **View recent attendance logs** from your device

## 🚀 **How to Use**

### 1. **Access the Test Page**
Visit: http://localhost:5173/biometric-test

### 2. **Set Up Your Credentials**
Make sure your `.env` file has your TeamOffice credentials:
```env
TEAMOFFICE_BASE=https://api.etimeoffice.com/api
TEAMOFFICE_CORP_ID=yourCorporateId
TEAMOFFICE_USERNAME=yourUsername
TEAMOFFICE_PASSWORD=yourPassword
TEAMOFFICE_TRUE_LITERAL=true
TEAMOFFICE_EMPCODE=ALL
ENABLE_SYNC=true
```

### 3. **Run Tests**
1. Click **"Run All Tests"** to test all API endpoints
2. Watch the **real-time results** in the Test Results section
3. Check the **Biometric Logs** tab for recent attendance data

### 4. **Test Your Biometric Device**
1. **Scan your fingerprint** on the biometric device
2. **Wait 30-60 seconds** for the data to sync
3. **Click "Run All Tests"** again to fetch the latest data
4. **Check the Biometric Logs** tab to see your scan

## 📊 **What You'll See**

### **API Tests Tab**
- ✅ **Health Check**: Server status
- ✅ **TeamOffice Connection**: API authentication
- ✅ **LastRecord Test**: Incremental data fetch
- ✅ **Date Range Test**: Historical data fetch
- ✅ **Employee Sync**: Employee data sync

### **Biometric Logs Tab**
- 👤 **Employee Name**: Who scanned
- 🆔 **Employee Code**: TeamOffice ID
- ⏰ **Punch Time**: When they scanned
- 🔄 **Type**: Check-in/Check-out
- 📱 **Device ID**: Which device was used
- 🔗 **Source**: Manual or TeamOffice

### **Settings Tab**
- ⚡ **Auto-refresh**: Automatically test every X seconds
- ⏱️ **Refresh Interval**: How often to test (10-300 seconds)

## 🔧 **Troubleshooting**

### **"API Test Failed"**
- Check your `.env` credentials
- Verify TeamOffice account access
- Check network connection

### **"No Biometric Logs"**
- Make sure someone has scanned recently
- Check if sync is enabled (`ENABLE_SYNC=true`)
- Try running tests manually

### **"TeamOffice Connection Failed"**
- Verify your corporate ID
- Check username/password
- Contact TeamOffice support if needed

## 🎉 **Success Indicators**

When everything is working, you'll see:
- ✅ All API tests showing "Success"
- 📊 Real biometric data in the logs
- 🔄 New scans appearing after each test
- ⏰ Timestamps updating in real-time

## 💡 **Pro Tips**

1. **Enable Auto-refresh** to catch scans automatically
2. **Set a 30-second interval** for real-time monitoring
3. **Check the logs tab** after each scan
4. **Use the date picker** to test historical data
5. **Clear results** periodically to keep it clean

This test page is perfect for verifying that your biometric device integration is working correctly! 🎯
