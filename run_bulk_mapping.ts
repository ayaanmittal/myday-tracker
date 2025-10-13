import { processBulkEmployeeMapping, generateMappingReport } from './src/services/bulkEmployeeMapping';

/**
 * Run bulk employee mapping with different configurations
 */
async function runBulkMapping() {
  console.log('🚀 Starting Bulk Employee Mapping\n');

  try {
    // Configuration 1: Conservative (high confidence auto-mapping)
    console.log('📋 Configuration 1: Conservative Mapping');
    console.log('   - Auto-map only 90%+ confidence matches');
    console.log('   - Don\'t create missing users\n');
    
    const conservativeResult = await processBulkEmployeeMapping({
      minMatchScore: 0.3,
      autoMapThreshold: 0.9,
      createMissingUsers: false
    });

    console.log('📊 Conservative Results:');
    console.log(`   Auto-mapped: ${conservativeResult.autoMapped}`);
    console.log(`   Manual review: ${conservativeResult.manualReview}`);
    console.log(`   Errors: ${conservativeResult.errors}\n`);

    // If there are manual review items, show them
    if (conservativeResult.manualReview > 0) {
      console.log('⚠️  Manual Review Required:');
      conservativeResult.results
        .filter(r => r.status === 'manual_review')
        .forEach(r => {
          console.log(`   ${r.teamofficeName} (${r.empCode}) -> ${r.ourUserName} (${(r.matchScore! * 100).toFixed(1)}%)`);
        });
      console.log('');
    }

    // Ask if user wants to proceed with aggressive mapping
    console.log('📋 Configuration 2: Aggressive Mapping');
    console.log('   - Auto-map 80%+ confidence matches');
    console.log('   - Create users for unmapped employees\n');

    const aggressiveResult = await processBulkEmployeeMapping({
      minMatchScore: 0.3,
      autoMapThreshold: 0.8,
      createMissingUsers: true
    });

    console.log('📊 Aggressive Results:');
    console.log(`   Auto-mapped: ${aggressiveResult.autoMapped}`);
    console.log(`   Manual review: ${aggressiveResult.manualReview}`);
    console.log(`   Errors: ${aggressiveResult.errors}\n`);

    // Generate detailed report
    const report = generateMappingReport(aggressiveResult);
    console.log('📄 Detailed Report:');
    console.log(report);

    // Show final summary
    console.log('✅ Bulk mapping completed!');
    console.log(`   Total employees processed: ${aggressiveResult.totalProcessed}`);
    console.log(`   Successfully mapped: ${aggressiveResult.autoMapped}`);
    console.log(`   Need manual review: ${aggressiveResult.manualReview}`);
    console.log(`   Errors: ${aggressiveResult.errors}`);

    if (aggressiveResult.manualReview > 0) {
      console.log('\n🔧 Next steps:');
      console.log('   1. Review the manual matches above');
      console.log('   2. Use the approveMapping function to approve correct matches');
      console.log('   3. Re-run the process for any remaining unmapped employees');
    }

  } catch (error) {
    console.error('❌ Error in bulk mapping:', error);
  }
}

/**
 * Run mapping for specific configuration
 */
async function runCustomMapping() {
  console.log('🎯 Running Custom Bulk Mapping\n');

  // You can customize these settings
  const config = {
    minMatchScore: 0.4,        // Show matches above 40%
    autoMapThreshold: 0.85,    // Auto-map above 85%
    createMissingUsers: false  // Don't create users automatically
  };

  console.log('⚙️  Configuration:');
  console.log(`   Min match score: ${config.minMatchScore * 100}%`);
  console.log(`   Auto-map threshold: ${config.autoMapThreshold * 100}%`);
  console.log(`   Create missing users: ${config.createMissingUsers}\n`);

  const result = await processBulkEmployeeMapping(config);
  
  console.log('📊 Results:');
  console.log(`   Total processed: ${result.totalProcessed}`);
  console.log(`   Auto-mapped: ${result.autoMapped}`);
  console.log(`   Manual review: ${result.manualReview}`);
  console.log(`   Errors: ${result.errors}`);

  return result;
}

/**
 * Show unmapped employees that need attention
 */
async function showUnmappedEmployees() {
  console.log('🔍 Finding Unmapped Employees\n');

  try {
    const { getUnmappedEmployees } = await import('./src/services/teamOfficeEmployees');
    const unmapped = await getUnmappedEmployees();

    console.log(`Found ${unmapped.length} unmapped employees:\n`);

    unmapped.forEach((emp, index) => {
      console.log(`${index + 1}. ${emp.name} (${emp.emp_code})`);
      if (emp.email) console.log(`   Email: ${emp.email}`);
      if (emp.department) console.log(`   Department: ${emp.department}`);
      if (emp.designation) console.log(`   Designation: ${emp.designation}`);
      
      if (emp.suggested_matches.length > 0) {
        console.log(`   Suggested matches:`);
        emp.suggested_matches.forEach(match => {
          console.log(`     - ${match.name} (${(match.match_score * 100).toFixed(1)}%)`);
        });
      } else {
        console.log(`   No suggested matches found`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error fetching unmapped employees:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';

  switch (command) {
    case 'run':
      await runBulkMapping();
      break;
    case 'custom':
      await runCustomMapping();
      break;
    case 'unmapped':
      await showUnmappedEmployees();
      break;
    default:
      console.log('Available commands:');
      console.log('  run      - Run bulk mapping with both conservative and aggressive configs');
      console.log('  custom   - Run with custom configuration');
      console.log('  unmapped - Show unmapped employees that need attention');
  }
}

// Run the script
main().catch(console.error);




