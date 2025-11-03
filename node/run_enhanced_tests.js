/**
 * Enhanced Test Runner with Process Memory and Fast-Glob Support
 * 
 * This runner executes comprehensive scaling tests with:
 * - Original find() approach
 * - Generator-based findWithMetrics()
 * - Memory-optimized findMemoryOptimized()
 * - Fast-Glob (native implementation)
 * 
 * Tracks both heap memory and process memory (RSS) for complete analysis
 */

const EnhancedScalingPerformanceTest = require('./enhanced_scaling_performance_test');
const emem = require('./enhanced-memory-utils');
const path = require('path');

async function main() {
    console.log('🎯 ENHANCED AZURE PIPELINES SCALING TEST RUNNER');
    console.log('================================================');
    console.log('🚀 Testing 4 approaches with process memory tracking');
    console.log('');
    
    // Configuration
    const basePath = 'C:\\RISHABH\\ADO\\Test';
    
    // System overview
    const systemInfo = emem.getSystemMemoryInfo();
    console.log('🖥️  System Overview:');
    console.log(`   📍 Base Path: ${basePath}`);
    console.log(`   💾 System Memory: ${systemInfo.totalGB}GB total, ${systemInfo.freeGB}GB free (${systemInfo.usagePercent}% used)`);
    console.log(`   ⚡ Node.js: ${process.version}`);
    console.log(`   🔧 V8 Heap Limit: ~${Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024)}MB`);
    console.log('');
    
    console.log('📊 Test Configuration:');
    console.log(`   🔄 Scales: level_10 (100k) to root (1M+ files)`);
    console.log(`   ⏱️  Timeout: 15 minutes per test`);
    console.log(`   🧠 Memory: Heap + RSS (process memory) tracking`);
    console.log(`   📈 Approaches: Original, Generator, Memory-Optimized, Fast-Glob`);
    console.log('');
    
    if (global.gc) {
        console.log('✅ Garbage collection available for accurate testing');
    } else {
        console.log('⚠️  For best results, run with: node --expose-gc run_enhanced_tests.js');
    }
    
    console.log('');
    
    try {
        // Initialize the enhanced test runner
        const tester = new EnhancedScalingPerformanceTest(basePath);
        
        console.log('🚀 Starting enhanced comprehensive scaling tests...');
        console.log('   📊 This will test all 4 approaches across multiple scales');
        console.log('   🔍 Monitoring both heap memory and process memory (RSS)');
        console.log('   🚀 Including Fast-Glob native performance comparison');
        console.log('');
        
        // Run the enhanced tests
        await tester.runEnhancedScalingTests();
        
        // Save enhanced results with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsFile = `enhanced-scaling-results-${timestamp}.json`;
        await tester.saveEnhancedResults(resultsFile);
        
        console.log('');
        console.log('✅ All enhanced tests completed successfully!');
        console.log(`📁 Enhanced results saved to: ${resultsFile}`);
        console.log('');
        console.log('📊 Key Insights:');
        console.log('   • Process Memory (RSS) shows actual RAM usage');
        console.log('   • Heap Memory shows V8 JavaScript memory usage');
        console.log('   • Fast-Glob provides native C++ performance baseline');
        console.log('   • Memory-Optimized approach balances speed and memory efficiency');
        
    } catch (error) {
        console.error('❌ Enhanced test execution failed:', error.message);
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
        
        // Additional error context
        console.error('');
        console.error('🔍 Troubleshooting:');
        console.error('   • Ensure test directory structure exists at C:\\RISHABH\\ADO\\Test');
        console.error('   • Check that fast-glob package is installed: npm install fast-glob');
        console.error('   • Verify sufficient system memory for large scale tests');
        console.error('   • Run with --expose-gc for optimal garbage collection');
        
        process.exit(1);
    }
}

// Additional utility function for quick memory checks
function checkSystemReadiness() {
    const systemInfo = emem.getSystemMemoryInfo();
    
    if (systemInfo.freeGB < 2) {
        console.warn('⚠️  Warning: Less than 2GB free memory. Large scale tests may fail.');
        console.log('   Consider closing other applications before running tests.');
    }
    
    if (systemInfo.usagePercent > 80) {
        console.warn('⚠️  Warning: System memory usage is above 80%. Tests may be slower.');
    }
    
    return systemInfo.freeGB >= 1; // Minimum 1GB free
}

// Pre-flight checks
if (require.main === module) {
    console.log('🔍 Pre-flight system check...');
    
    if (!checkSystemReadiness()) {
        console.error('❌ Insufficient system memory for reliable testing.');
        console.error('   Please free up memory and try again.');
        process.exit(1);
    }
    
    console.log('✅ System ready for enhanced testing\n');
    main().catch(console.error);
}

module.exports = { main, checkSystemReadiness };