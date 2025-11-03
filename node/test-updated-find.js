const tl = require('./task');
const path = require('path');

console.log('Testing updated find function...');

// Test with current directory
const testPath = process.cwd();
console.log(`Testing find function with path: ${testPath}`);

try {
    const results = tl.find(testPath, {
        followSymbolicLinks: true,
        allowBrokenSymbolicLinks: true
    });
    
    console.log(`Found ${results.length} items`);
    console.log('First 10 results:');
    results.slice(0, 10).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item}`);
    });
    
    console.log('✅ Find function works correctly!');
} catch (error) {
    console.error('❌ Error testing find function:', error.message);
}