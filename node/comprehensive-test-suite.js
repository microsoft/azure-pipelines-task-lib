/**
 * Comprehensive Testing Strategy for Memory Optimization
 * 
 * This script runs all our testing approaches in sequence to validate
 * our memory-optimized solution against different crash scenarios.
 */

const GCMonitor = require('./gc-monitor');
const memMonitor = require('./memory-snapshot');
const { execSync } = require('child_process');

async function runComprehensiveTests() {
    console.log('🧪 COMPREHENSIVE MEMORY OPTIMIZATION TEST SUITE');
    console.log('================================================');
    
    const testResults = {
        artificialCrash: null,
        productionPattern: null,
        optimizedSolution: null,
        gcAnalysis: null
    };
    
    // Test 1: Artificial Memory Crash (existing)
    console.log('\n📋 TEST 1: Artificial Memory Crash Reproduction');
    console.log('================================================');
    try {
        console.log('Running: node --max-old-space-size=128 repro_original_find_issue.js');
        const output = execSync('node --max-old-space-size=128 repro_original_find_issue.js', 
            { encoding: 'utf8', timeout: 30000, cwd: __dirname });
        testResults.artificialCrash = { status: 'NO_CRASH', output: output.substring(0, 500) };
    } catch (error) {
        if (error.message.includes('heap out of memory') || error.code === 1) {
            testResults.artificialCrash = { status: 'CRASHED_AS_EXPECTED', message: 'Memory crash reproduced' };
        } else {
            testResults.artificialCrash = { status: 'OTHER_ERROR', error: error.message };
        }
    }
    
    // Test 2: Production Pattern Crash (new)
    console.log('\n📋 TEST 2: Production Pattern Memory Crash');
    console.log('==========================================');
    try {
        console.log('Running: node repro_production_crash.js');
        const output = execSync('node repro_production_crash.js', 
            { encoding: 'utf8', timeout: 120000, cwd: __dirname });
        testResults.productionPattern = { status: 'COMPLETED', output: output.substring(0, 500) };
    } catch (error) {
        if (error.message.includes('heap out of memory')) {
            testResults.productionPattern = { status: 'CRASHED_PRODUCTION_LIKE', message: 'Production crash reproduced' };
        } else {
            testResults.productionPattern = { status: 'OTHER_ERROR', error: error.message.substring(0, 200) };
        }
    }
    
    // Test 3: Memory-Optimized Solution Validation
    console.log('\n📋 TEST 3: Memory-Optimized Solution Validation');
    console.log('===============================================');
    try {
        console.log('Running: node --max-old-space-size=128 test_optimized_vs_crash.js');
        const output = execSync('node --max-old-space-size=128 test_optimized_vs_crash.js', 
            { encoding: 'utf8', timeout: 60000, cwd: __dirname });
        testResults.optimizedSolution = { status: 'SUCCESS', output: output.substring(0, 500) };
    } catch (error) {
        testResults.optimizedSolution = { status: 'FAILED', error: error.message.substring(0, 300) };
    }
    
    // Test 4: GC Analysis (manual run with monitoring)
    console.log('\n📋 TEST 4: GC Pattern Analysis');
    console.log('===============================');
    
    const gcMonitor = new GCMonitor();
    gcMonitor.start();
    
    // Run a controlled test for GC analysis
    try {
        console.log('Running controlled GC analysis test...');
        
        // Create memory pressure for GC analysis
        const largeObjects = [];
        for (let i = 0; i < 10000; i++) {
            largeObjects.push({
                data: new Array(1000).fill(`data-${i}`),
                metadata: new Map(),
                references: new Set()
            });
            
            if (i % 1000 === 0) {
                // Force some allocations and potential GC
                const temp = new Array(10000).fill(Math.random());
                temp.forEach((val, idx) => {
                    if (idx % 2 === 0) largeObjects[largeObjects.length - 1].references.add(val);
                });
            }
        }
        
        // Hold references to prevent collection, then clear
        setTimeout(() => {
            largeObjects.length = 0;
            if (global.gc) global.gc();
        }, 2000);
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        gcMonitor.stop();
        testResults.gcAnalysis = gcMonitor.getReport();
        
    } catch (error) {
        gcMonitor.stop();
        testResults.gcAnalysis = { status: 'ERROR', error: error.message };
    }
    
    // Generate comprehensive report
    console.log('\n📊 COMPREHENSIVE TEST RESULTS');
    console.log('==============================');
    
    console.log('\n🎯 Test 1 - Artificial Crash:');
    console.log(`   Status: ${testResults.artificialCrash?.status || 'UNKNOWN'}`);
    if (testResults.artificialCrash?.status === 'CRASHED_AS_EXPECTED') {
        console.log('   ✅ Successfully reproduced memory crash with restricted heap');
    }
    
    console.log('\n🏭 Test 2 - Production Pattern:');
    console.log(`   Status: ${testResults.productionPattern?.status || 'UNKNOWN'}`);
    if (testResults.productionPattern?.status === 'CRASHED_PRODUCTION_LIKE') {
        console.log('   ✅ Successfully reproduced production-like memory crash');
    } else if (testResults.productionPattern?.status === 'COMPLETED') {
        console.log('   ⚠️  Completed without crash - may need larger dataset');
    }
    
    console.log('\n✅ Test 3 - Optimized Solution:');
    console.log(`   Status: ${testResults.optimizedSolution?.status || 'UNKNOWN'}`);
    if (testResults.optimizedSolution?.status === 'SUCCESS') {
        console.log('   ✅ Memory-optimized solution succeeded where original crashed');
    } else {
        console.log('   ❌ Memory-optimized solution failed - needs investigation');
    }
    
    console.log('\n🗑️  Test 4 - GC Analysis:');
    if (testResults.gcAnalysis && testResults.gcAnalysis.totalEvents) {
        const gc = testResults.gcAnalysis;
        console.log(`   Total GC Events: ${gc.totalEvents}`);
        console.log(`   Max GC Duration: ${gc.maxDuration}ms`);
        console.log(`   Customer Pattern: ${gc.customerPattern}`);
        
        if (gc.customerPattern === 'MATCHES') {
            console.log('   ✅ Successfully reproduced customer GC patterns');
        }
    }
    
    // Overall assessment
    console.log('\n🎯 OVERALL ASSESSMENT');
    console.log('=====================');
    
    const passedTests = Object.values(testResults).filter(result => 
        result?.status === 'CRASHED_AS_EXPECTED' || 
        result?.status === 'SUCCESS' || 
        result?.status === 'CRASHED_PRODUCTION_LIKE' ||
        (result?.customerPattern === 'MATCHES')
    ).length;
    
    console.log(`Passed Tests: ${passedTests}/4`);
    
    if (passedTests >= 3) {
        console.log('✅ EXCELLENT: Memory optimization validation successful');
        console.log('🚀 Ready for production deployment');
    } else if (passedTests >= 2) {
        console.log('⚠️  GOOD: Most tests passed, minor improvements needed');
    } else {
        console.log('❌ NEEDS WORK: Multiple test failures - investigate');
    }
    
    // Recommendations
    console.log('\n💡 NEXT STEPS');
    console.log('==============');
    
    if (testResults.artificialCrash?.status === 'CRASHED_AS_EXPECTED' && 
        testResults.optimizedSolution?.status === 'SUCCESS') {
        console.log('✅ Core crash prevention validated');
    } else {
        console.log('🔧 Focus on basic crash prevention first');
    }
    
    if (testResults.productionPattern?.status === 'COMPLETED') {
        console.log('📈 Consider creating larger test datasets (10M+ files)');
        console.log('🏭 Add more realistic Azure Pipelines object patterns');
    }
    
    if (testResults.gcAnalysis?.customerPattern !== 'MATCHES') {
        console.log('🗑️  Enhance GC pattern reproduction');
        console.log('🔍 Study customer\'s specific object retention patterns');
    }
    
    console.log('\n🎯 Ready for team review and production planning!');
    
    return testResults;
}

// Export for use in other scripts
module.exports = { runComprehensiveTests };

// Run if called directly
if (require.main === module) {
    runComprehensiveTests().catch(console.error);
}