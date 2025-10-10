# TeamOffice API Configuration Guide

## 🔑 **API Keys Confirmed**

Based on the official TeamOffice API documentation, here are the confirmed API details:

### **Authentication**
- **Type**: Basic Authentication
- **Header Key**: `Authorization`
- **Format**: `corporateid:username:password:true` (base64 encoded)
- **Test Credentials**: `support:support:support@1:true`
- **Test Authorization Value**: `c3VwcG9ydDpzdXBwb3J0OnN1cHBvcnQ6dHJ1ZTo=`

### **API Endpoints**
1. **API 1 (Row Data)**: `https://api.etimeoffice.com/api/DownloadPunchData`
2. **API 2 (Row Data with MCID)**: `https://api.etimeoffice.com/api/DownloadPunchDataMCID`
3. **API 3 (IN/OUT Data)**: `https://api.etimeoffice.com/api/DownloadInOutPunchData`
4. **API 4 (LastRecord)**: `https://api.etimeoffice.com/api/DownloadLastPunchData`

### **Environment Variables**
Create a `.env` file with your credentials:

```env
# TeamOffice API Configuration
TEAMOFFICE_BASE=https://api.etimeoffice.com/api
TEAMOFFICE_CORP_ID=yourCorporateId
TEAMOFFICE_USERNAME=yourUsername
TEAMOFFICE_PASSWORD=yourPassword
TEAMOFFICE_TRUE_LITERAL=true

# Employee Filter
TEAMOFFICE_EMPCODE=ALL

# Sync Configuration
SYNC_INTERVAL_MINUTES=3
TIMEZONE=Asia/Kolkata
PORT=3000
```

### **Testing the API**

1. **Test API Connection**:
```bash
npm run test-api
```

2. **Test via Server Endpoint**:
```bash
curl http://localhost:3000/api/test/teamoffice
```

3. **Manual Sync Test**:
```bash
npm run sync
```

### **API Parameters**

#### **Date Format**
- **Format**: `dd/MM/yyyy_HH:mm`
- **Example**: `01/01/2025_09:00`

#### **LastRecord Format**
- **Format**: `MMyyyy$ID`
- **Example**: `092020$454`

#### **Employee Code**
- **ALL**: Get data for all employees
- **Specific Code**: Get data for specific employee (e.g., `0001`)

### **Response Handling**

The API returns different response formats:
- **Array**: Direct array of records
- **Object with data**: `{ data: [...] }`
- **Object with logs**: `{ logs: [...] }`

Our implementation normalizes all these formats automatically.

### **Error Handling**

Common errors and solutions:
- **401 Unauthorized**: Check your credentials
- **403 Forbidden**: Verify corporate ID and permissions
- **404 Not Found**: Check API endpoint URLs
- **Timeout**: Increase timeout value or check network

### **Rate Limiting**

- **Recommended**: 3-minute intervals for incremental sync
- **Daily**: Employee sync at 6 AM
- **Manual**: On-demand sync via API endpoints

### **Security Notes**

- Store credentials in environment variables
- Never commit `.env` files to version control
- Use HTTPS for production
- Monitor API usage and logs

### **Monitoring**

Check server logs for:
- Successful API calls
- Authentication errors
- Data processing issues
- Sync statistics

### **Troubleshooting**

1. **Connection Issues**:
   - Verify network connectivity
   - Check firewall settings
   - Test with curl or Postman

2. **Authentication Issues**:
   - Verify credentials format
   - Check base64 encoding
   - Test with provided test credentials

3. **Data Issues**:
   - Check date format
   - Verify employee codes
   - Review response structure

### **Support**

For API-related issues:
- Contact TeamOffice support
- Check official documentation
- Review server logs for detailed error messages
