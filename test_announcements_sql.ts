import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAnnouncementsSQL() {
  try {
    console.log('🧪 Testing announcements SQL...');
    
    // Read the SQL file
    const sqlContent = fs.readFileSync('./create_announcements_table.sql', 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n🔄 Executing statement ${i + 1}/${statements.length}:`);
      console.log(statement.substring(0, 100) + '...');
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          return;
        }
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err);
        return;
      }
    }
    
    console.log('\n🎉 All SQL statements executed successfully!');
    
    // Test the tables exist
    console.log('\n🔍 Verifying tables were created...');
    
    const { data: announcements, error: announcementsError } = await supabase
      .from('announcements')
      .select('*')
      .limit(1);
    
    if (announcementsError) {
      console.error('❌ Announcements table error:', announcementsError);
    } else {
      console.log('✅ Announcements table exists');
    }
    
    const { data: recipients, error: recipientsError } = await supabase
      .from('announcement_recipients')
      .select('*')
      .limit(1);
    
    if (recipientsError) {
      console.error('❌ Announcement recipients table error:', recipientsError);
    } else {
      console.log('✅ Announcement recipients table exists');
    }
    
    const { data: views, error: viewsError } = await supabase
      .from('announcement_views')
      .select('*')
      .limit(1);
    
    if (viewsError) {
      console.error('❌ Announcement views table error:', viewsError);
    } else {
      console.log('✅ Announcement views table exists');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAnnouncementsSQL();
















