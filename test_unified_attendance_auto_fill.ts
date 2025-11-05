import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUnifiedAttendanceAutoFill() {
    console.log('🧪 Testing unified_attendance auto-fill functionality...\n');

    try {
        // Step 1: Check current stats
        console.log('📊 Current profile data stats:');
        const { data: stats, error: statsError } = await supabase
            .rpc('get_unified_attendance_profile_stats');
        
        if (statsError) {
            console.error('❌ Error getting stats:', statsError);
            return;
        }
        
        if (stats && stats.length > 0) {
            const stat = stats[0];
            console.log(`   Total records: ${stat.total_records}`);
            console.log(`   Complete records: ${stat.complete_records}`);
            console.log(`   Missing profile_id: ${stat.missing_profile_id}`);
            console.log(`   Missing employee_code: ${stat.missing_employee_code}`);
            console.log(`   Missing employee_name: ${stat.missing_employee_name}`);
            console.log(`   Completion rate: ${stat.completion_rate}%\n`);
        }

        // Step 2: Check recent records with missing data
        console.log('🔍 Recent records with missing profile data:');
        const { data: missingRecords, error: missingError } = await supabase
            .from('v_unified_attendance_missing_profile')
            .select('*')
            .limit(10);
        
        if (missingError) {
            console.error('❌ Error getting missing records:', missingError);
        } else if (missingRecords && missingRecords.length > 0) {
            missingRecords.forEach(record => {
                console.log(`   ${record.entry_date}: ${record.missing_field} - ${record.employee_code || 'N/A'}:${record.employee_name || 'N/A'}`);
            });
        } else {
            console.log('   ✅ No records with missing profile data found!\n');
        }

        // Step 3: Test backfill function
        console.log('🔄 Running backfill for recent records...');
        const { data: backfillResult, error: backfillError } = await supabase
            .rpc('backfill_unified_attendance_profile_data', {
                start_date_param: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date_param: new Date().toISOString().split('T')[0]
            });
        
        if (backfillError) {
            console.error('❌ Error running backfill:', backfillError);
        } else if (backfillResult && backfillResult.length > 0) {
            const result = backfillResult[0];
            console.log(`   Processed: ${result.processed_count}`);
            console.log(`   Updated: ${result.updated_count}`);
            console.log(`   Errors: ${result.error_count}\n`);
        }

        // Step 4: Test inserting a new record to verify trigger works
        console.log('🧪 Testing trigger with new record...');
        
        // Get a test user
        const { data: testUser, error: userError } = await supabase
            .from('profiles')
            .select('id, name')
            .limit(1)
            .single();
        
        if (userError || !testUser) {
            console.log('   ⚠️  No test user found, skipping trigger test');
        } else {
            // Insert a test record with minimal data
            const { data: insertResult, error: insertError } = await supabase
                .from('unified_attendance')
                .insert({
                    user_id: testUser.id,
                    entry_date: new Date().toISOString().split('T')[0],
                    check_in_at: new Date().toISOString(),
                    device_info: 'Test Auto-fill',
                    source: 'manual'
                })
                .select('id, profile_id, employee_code, employee_name')
                .single();
            
            if (insertError) {
                console.error('   ❌ Error inserting test record:', insertError);
            } else {
                console.log('   ✅ Test record inserted successfully:');
                console.log(`      ID: ${insertResult.id}`);
                console.log(`      Profile ID: ${insertResult.profile_id || 'NULL'}`);
                console.log(`      Employee Code: ${insertResult.employee_code || 'NULL'}`);
                console.log(`      Employee Name: ${insertResult.employee_name || 'NULL'}`);
                
                // Clean up test record
                await supabase
                    .from('unified_attendance')
                    .delete()
                    .eq('id', insertResult.id);
                console.log('   🧹 Test record cleaned up\n');
            }
        }

        // Step 5: Check final stats
        console.log('📊 Final profile data stats:');
        const { data: finalStats, error: finalStatsError } = await supabase
            .rpc('get_unified_attendance_profile_stats');
        
        if (finalStatsError) {
            console.error('❌ Error getting final stats:', finalStatsError);
        } else if (finalStats && finalStats.length > 0) {
            const stat = finalStats[0];
            console.log(`   Total records: ${stat.total_records}`);
            console.log(`   Complete records: ${stat.complete_records}`);
            console.log(`   Missing profile_id: ${stat.missing_profile_id}`);
            console.log(`   Missing employee_code: ${stat.missing_employee_code}`);
            console.log(`   Missing employee_name: ${stat.missing_employee_name}`);
            console.log(`   Completion rate: ${stat.completion_rate}%\n`);
        }

        console.log('✅ Auto-fill functionality test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testUnifiedAttendanceAutoFill();



