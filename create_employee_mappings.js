// Script to create employee mappings
// Run this in the browser console while logged in as an admin

async function createEmployeeMappings() {
  console.log('Creating employee mappings...');
  
  // Manual mappings based on the profiles we found
  const mappings = [
    { teamoffice_code: '0005', teamoffice_name: 'Hiralal', profile_id: '4d8ab840-efdf-437c-b836-242198244198' },
    { teamoffice_code: '0008', teamoffice_name: 'Jasspreet', profile_id: '668618a1-1425-4c6c-8c91-872480b5696e' },
    { teamoffice_code: '0012', teamoffice_name: 'Dolly', profile_id: '5d9bb940-0431-4b81-a7d5-7759c91c69b5' },
    { teamoffice_code: '0013', teamoffice_name: 'Isha', profile_id: 'b7a7c54b-eeaf-47ab-bcb8-8e22bdf38dc0' },
    { teamoffice_code: '0015', teamoffice_name: 'Ayaan', profile_id: '596441e8-c05d-4c81-b19f-e1cb1e8fe460' }
  ];
  
  // Import supabase client (assuming it's available globally)
  const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js@2');
  
  const supabaseUrl = 'https://iurnwjzxqskliuyttomt.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cm53anp4cXNrbGl1eXR0b210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY0NDc0ODAsImV4cCI6MjA1MjAyMzQ4MH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  for (const mapping of mappings) {
    try {
      // Create the mapping
      const { error: mappingError } = await supabase
        .from('employee_mappings')
        .insert({
          teamoffice_emp_code: mapping.teamoffice_code,
          teamoffice_name: mapping.teamoffice_name,
          our_user_id: mapping.profile_id, // Using profile.id as user_id
          our_profile_id: mapping.profile_id, // Using profile.id as profile_id
          is_active: true
        });
      
      if (mappingError) {
        console.log(`❌ Error creating mapping for ${mapping.teamoffice_name}: ${mappingError.message}`);
      } else {
        console.log(`✅ Mapped ${mapping.teamoffice_name} (${mapping.teamoffice_code}) -> Profile ID: ${mapping.profile_id}`);
      }
    } catch (error) {
      console.log(`❌ Error processing ${mapping.teamoffice_name}: ${error}`);
    }
  }
  
  // Check final mappings
  console.log('\nFinal mappings:');
  const { data: finalMappings } = await supabase
    .from('employee_mappings')
    .select('*');
  
  console.log(`Total mappings created: ${finalMappings?.length || 0}`);
  if (finalMappings) {
    finalMappings.forEach(mapping => {
      console.log(`- ${mapping.teamoffice_emp_code} (${mapping.teamoffice_name}) -> User: ${mapping.our_user_id}, Profile: ${mapping.our_profile_id}`);
    });
  }
}

// Run the function
createEmployeeMappings();
