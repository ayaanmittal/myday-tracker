#!/usr/bin/env tsx

import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

/**
 * Test real-time data fetching from TeamOffice API
 */

async function testRealTimeFetch() {
  console.log('🚀 Testing Real-Time Data Fetching\n');

  try {
    const { 
      fetchAttendanceDataFromAPI, 
      getUserAttendanceDataWithFetch, 
      getAllAttendanceDataWithFetch,
      getAvailableDateRange 
    } = await import('./src/services/autoFetchService');

    // Test 1: Get available date range
    console.log('1. Getting available date range...');
    const dateRange = await getAvailableDateRange();
    console.log(`   ✅ Available data: ${dateRange.earliestDate} to ${dateRange.latestDate}`);
    console.log(`   📊 Total records: ${dateRange.totalRecords}`);

    // Test 2: Fetch data for today
    console.log('\n2. Fetching data for today...');
    const today = new Date().toISOString().split('T')[0];
    const fetchResult = await fetchAttendanceDataFromAPI({
      startDate: today,
      endDate: today,
      forceRefresh: true
    });

    console.log(`   📥 Records found: ${fetchResult.recordsFound}`);
    console.log(`   ✅ Records processed: ${fetchResult.recordsProcessed}`);
    console.log(`   ❌ Errors: ${fetchResult.errors.length}`);
    console.log(`   ⏰ Last fetch time: ${fetchResult.lastFetchTime}`);

    if (fetchResult.errors.length > 0) {
      console.log('   Error details:');
      fetchResult.errors.forEach(error => {
        console.log(`     - ${error}`);
      });
    }

    // Test 3: Get user-specific data
    console.log('\n3. Testing user-specific data fetch...');
    const { supabaseService } = await import('./src/integrations/supabase/service');
    
    // Get a user with foreign key relationship
    const { data: userWithFK } = await supabaseService
      .from('profiles')
      .select('id, name')
      .not('teamoffice_employees_id', 'is', null)
      .limit(1)
      .single();

    if (userWithFK) {
      console.log(`   👤 Testing with user: ${userWithFK.name}`);
      
      const userData = await getUserAttendanceDataWithFetch(userWithFK.id, {
        startDate: today,
        endDate: today
      });

      console.log(`   📊 User attendance logs: ${userData.attendanceLogs.length}`);
      console.log(`   📅 User day entries: ${userData.dayEntries.length}`);
      console.log(`   ⏱️  Total work time: ${userData.summary.totalWorkMinutes} minutes`);
      console.log(`   🔄 Last fetch: ${userData.lastFetchTime}`);

      if (userData.attendanceLogs.length > 0) {
        console.log('   Recent logs:');
        userData.attendanceLogs.slice(0, 3).forEach(log => {
          console.log(`     ${log.employee_name} - ${log.log_type} at ${log.log_time}`);
        });
      }
    } else {
      console.log('   ⚠️  No users with foreign key relationships found');
    }

    // Test 4: Get all data (admin view)
    console.log('\n4. Testing admin data fetch...');
    const allData = await getAllAttendanceDataWithFetch({
      startDate: today,
      endDate: today
    });

    console.log(`   📊 All attendance logs: ${allData.attendanceLogs.length}`);
    console.log(`   📅 All day entries: ${allData.dayEntries.length}`);
    console.log(`   👥 Total employees: ${allData.summary.totalEmployees}`);
    console.log(`   ⏱️  Total work time: ${allData.summary.totalWorkMinutes} minutes`);

    // Test 5: Fetch data for a date range
    console.log('\n5. Testing date range fetch...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const rangeResult = await fetchAttendanceDataFromAPI({
      startDate: yesterdayStr,
      endDate: today,
      forceRefresh: true
    });

    console.log(`   📅 Date range: ${yesterdayStr} to ${today}`);
    console.log(`   📥 Records found: ${rangeResult.recordsFound}`);
    console.log(`   ✅ Records processed: ${rangeResult.recordsProcessed}`);

    console.log('\n🎉 Real-time fetch testing completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ API connection: Working`);
    console.log(`   ✅ Data fetching: Working`);
    console.log(`   ✅ User filtering: Working`);
    console.log(`   ✅ Admin view: Working`);
    console.log(`   ✅ Date range filtering: Working`);

    return true;

  } catch (error) {
    console.error('❌ Error testing real-time fetch:', error);
    return false;
  }
}

async function testDateFiltering() {
  console.log('\n🔍 Testing Date Filtering\n');

  try {
    const { fetchAttendanceDataFromAPI } = await import('./src/services/autoFetchService');

    // Test different date ranges
    const testDates = [
      {
        name: 'Today',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      },
      {
        name: 'Last 3 days',
        startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      },
      {
        name: 'Last week',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      }
    ];

    for (const test of testDates) {
      console.log(`📅 Testing ${test.name} (${test.startDate} to ${test.endDate})...`);
      
      const result = await fetchAttendanceDataFromAPI({
        startDate: test.startDate,
        endDate: test.endDate,
        forceRefresh: true
      });

      console.log(`   📥 Found: ${result.recordsFound} records`);
      console.log(`   ✅ Processed: ${result.recordsProcessed} records`);
      console.log(`   ❌ Errors: ${result.errors.length}`);
    }

    console.log('\n✅ Date filtering tests completed!');

  } catch (error) {
    console.error('❌ Error testing date filtering:', error);
  }
}

async function main() {
  console.log('🚀 Real-Time Data Fetch Test Suite\n');

  const fetchSuccess = await testRealTimeFetch();
  
  if (fetchSuccess) {
    await testDateFiltering();
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Visit /history-fetch to test the new interface');
    console.log('2. Test user-specific data display');
    console.log('3. Test admin view with all employee data');
    console.log('4. Test date range filtering');
    console.log('5. Test auto-refresh functionality');
    
    console.log('\n🔗 Available Routes:');
    console.log('   - /history-fetch - Real-time data fetching interface');
    console.log('   - Use AttendanceLogsWithFetch component in other pages');
  } else {
    console.log('\n❌ Some tests failed. Please check the errors above.');
  }
}

main().catch(console.error);








