/**
 * Simple runner script for Scaling Performance Tests
 * 
 * This script makes it easy to run the scaling performance tests
 * on your directory structure at C:\RISHABH\ADO\Test
 */

const ScalingPerformanceTest = require('./scaling_performance_test');
const path = require('path');

async function main() {
    console.log('🎯 AZURE PIPELINES SCALING TEST RUNNER');
    console.log('======================================');
    console.log('');
    
    // Configuration
    const basePath = 'C:\\RISHABH\\ADO\\Test';
    
    console.log(`📍 Base Path: ${basePath}`);
    console.log(`🔄 Will test from level_10 (100k) to root (1M files)`);
    console.log(`⏱️  15 minute timeout per test`);
    console.log(`📊 Results will be saved to JSON file`);
    console.log('');
    
    try {
        // Initialize the test runner
        const tester = new ScalingPerformanceTest(basePath);
        
        console.log('🚀 Starting comprehensive scaling tests...');
        console.log('');
        
        // Run the tests
        await tester.runScalingTests();
        
        // Save results with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsFile = `scaling-results-${timestamp}.json`;
        await tester.saveResults(resultsFile);
        
        console.log('');
        console.log('✅ All tests completed successfully!');
        console.log(`📁 Results saved to: ${resultsFile}`);
        
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = main;