#!/usr/bin/env tsx

import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

/**
 * Debug punch data format
 */

async function debugPunchData() {
  console.log('🔍 Debugging Punch Data Format\n');

  try {
    const { getRawRangeMCID } = await import('./src/services/teamOffice');

    // Get today's punch data
    const today = new Date();
    const fromDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}_00:00`;
    const toDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}_23:59`;

    console.log(`📅 Fetching punch data from ${fromDate} to ${toDate}`);

    const punchData = await getRawRangeMCID(fromDate, toDate, 'ALL');
    
    if (!punchData || !punchData.PunchData || !Array.isArray(punchData.PunchData)) {
      console.log('❌ No punch data found');
      return;
    }

    console.log(`📥 Found ${punchData.PunchData.length} punch records`);
    console.log('\n🔍 Sample punch data:');
    
    punchData.PunchData.slice(0, 3).forEach((record: any, index: number) => {
      console.log(`\nRecord ${index + 1}:`);
      console.log(`  Empcode: ${record.Empcode}`);
      console.log(`  Name: ${record.Name}`);
      console.log(`  PunchDate: ${record.PunchDate}`);
      console.log(`  M_Flag: ${record.M_Flag}`);
      console.log(`  mcid: ${record.mcid}`);
      
      // Debug date parsing
      console.log(`\n  Date parsing debug:`);
      const punchDate = record.PunchDate.split(' ')[0];
      console.log(`    PunchDate split[0]: ${punchDate}`);
      
      const punchTime = record.PunchDate.split(' ')[1];
      console.log(`    PunchDate split[1]: ${punchTime}`);
      
      // Try to parse the date
      try {
        const [day, month, year] = punchDate.split('/');
        console.log(`    Day: ${day}, Month: ${month}, Year: ${year}`);
        
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        console.log(`    Parsed date: ${date.toISOString()}`);
        console.log(`    Is valid: ${!isNaN(date.getTime())}`);
      } catch (error) {
        console.log(`    Date parsing error: ${error}`);
      }
      
      // Try to parse the time
      try {
        const [time, seconds] = punchTime.split(':');
        console.log(`    Time: ${time}, Seconds: ${seconds}`);
        console.log(`    Time only: ${time}`);
      } catch (error) {
        console.log(`    Time parsing error: ${error}`);
      }
    });

  } catch (error) {
    console.error('❌ Error debugging punch data:', error);
  }
}

async function main() {
  console.log('🚀 Punch Data Debug\n');
  await debugPunchData();
  console.log('\n✨ Debug completed!');
}

main().catch(console.error);


