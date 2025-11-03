/**
 * Simple runner script for Enhanced Scaling Performance Tests
 * 
 * This script makes it easy to run enhanced scaling performance tests
 * with process memory tracking and fast-glob comparison
 */

const EnhancedScalingPerformanceTest = require('./enhanced_scaling_performance_test');

async function main() {
    const args = process.argv.slice(2);
    let level = 1;
    let basePath = 'C:\\RISHABH\\ADO\\Test';
    
    // Simple argument parsing
    if (args.includes('--help') || args.includes('-h')) {
        console.log('🎯 Enhanced Scaling Test Runner');
        console.log('');
        console.log('Quick test commands:');
        console.log('  npm run test:enhanced:1    # Test 100k files only');
        console.log('  npm run test:enhanced:3    # Test up to 300k files');
        console.log('  npm run test:enhanced:5    # Test up to 500k files');
        console.log('  npm run test:enhanced:10   # Test all scales (up to 1M files)');
        console.log('');
        console.log('With garbage collection (recommended):');
        console.log('  npm run test:enhanced:gc:1 # Test 100k with accurate memory tracking');
        console.log('');
        console.log('Manual usage:');
        console.log('  node run_enhanced_tests.js [level]');
        console.log('  node --expose-gc run_enhanced_tests.js [level]');
        return;
    }
    
    // Get level from first argument
    if (args[0] && !isNaN(parseInt(args[0]))) {
        level = parseInt(args[0]);
        if (level < 1 || level > 10) {
            console.error('❌ Level must be between 1 and 10');
            process.exit(1);
        }
    }
    
    console.log('🎯 ENHANCED AZURE PIPELINES SCALING TEST RUNNER');
    console.log('=================================================');
    console.log('');
    
    console.log(`📍 Base Path: ${basePath}`);
    console.log(`📊 Testing up to Level ${level} (${level * 100}k files max)`);
    console.log(`🚀 Approaches: Original, Generator, Memory-Optimized, Fast-Glob`);
    console.log(`📈 Memory: Heap + Process (RSS) tracking`);
    console.log(`⏱️  Timeout: 15 minutes per test`);
    console.log('');
    
    if (global.gc) {
        console.log('✅ Garbage collection enabled for accurate memory testing');
    } else {
        console.log('⚠️  For best memory accuracy, run with: node --expose-gc run_enhanced_tests.js');
    }
    console.log('');
    
    try {
        // Initialize the enhanced test runner
        const tester = new EnhancedScalingPerformanceTest(basePath, level);
        
        console.log('🚀 Starting enhanced scaling tests...');
        console.log('');
        
        // Run the tests
        await tester.runEnhancedScalingTests();
        
        // Save results with level info
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsFile = `enhanced-results-L${level}-${timestamp}.json`;
        await tester.saveEnhancedResults(resultsFile);
        
        console.log('');
        console.log('✅ All enhanced tests completed successfully!');
        console.log(`📁 Results saved to: ${resultsFile}`);
        
        // Show quick summary
        const fastest = tester.getFastestOverall();
        const mostMemoryEfficient = tester.getMostMemoryEfficientOverall();
        const mostRSSEfficient = tester.getMostRSSEfficientOverall();
        
        if (fastest) {
            console.log('');
            console.log('🏆 QUICK SUMMARY:');
            console.log(`   🏃 Fastest Overall: ${fastest.approach} (${(fastest.duration / 1000).toFixed(1)}s on ${fastest.scale * 100}k files)`);
            if (mostMemoryEfficient) {
                console.log(`   🧠 Most Heap Efficient: ${mostMemoryEfficient.approach} (${(mostMemoryEfficient.peakMemory / 1024 / 1024).toFixed(1)}MB on ${mostMemoryEfficient.scale * 100}k files)`);
            }
            if (mostRSSEfficient) {
                console.log(`   💾 Most RSS Efficient: ${mostRSSEfficient.approach} (${mostRSSEfficient.peakRSS_MB.toFixed(1)}MB on ${mostRSSEfficient.scale * 100}k files)`);
            }
        }
        
    } catch (error) {
        console.error('❌ Enhanced test execution failed:', error.message);
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