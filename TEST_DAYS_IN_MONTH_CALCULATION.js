// Test script to verify days in month calculation
// This script tests the JavaScript calculation for total days in a month

function getDaysInMonth(monthString) {
  const monthDate = new Date(monthString + '-01');
  const totalDaysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  return totalDaysInMonth;
}

// Test different months
console.log('Testing days in month calculation:');
console.log('October 2025:', getDaysInMonth('2025-10')); // Should be 31
console.log('November 2025:', getDaysInMonth('2025-11')); // Should be 30
console.log('December 2025:', getDaysInMonth('2025-12')); // Should be 31
console.log('February 2025:', getDaysInMonth('2025-02')); // Should be 28
console.log('February 2024:', getDaysInMonth('2024-02')); // Should be 29 (leap year)

// Test with actual dates
console.log('\nTesting with actual dates:');
const testMonths = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02'];
testMonths.forEach(month => {
  const days = getDaysInMonth(month);
  console.log(`${month}: ${days} days`);
});

// Test daily rate calculation
console.log('\nTesting daily rate calculation:');
const baseSalary = 5000;
const octoberDays = getDaysInMonth('2025-10');
const dailyRate = baseSalary / octoberDays;
console.log(`Base Salary: ₹${baseSalary}`);
console.log(`October 2025 days: ${octoberDays}`);
console.log(`Daily Rate: ₹${dailyRate.toFixed(2)}`);



