/**
 * Reproduce Original find() Memory Crash Issue
 * 
 * This script forces a "JavaScript heap out of memory" error by either:
 * 1. Using a very large directory (1.2M files)
 * 2. Restricting Node.js heap size to trigger crash sooner
 * 
 * Run with: node --max-old-space-size=512 repro_original_find_issue.js
 */

const tl = require('./_build/task');
const fs = require('fs');
const { getProcessMemoryUsage } = require('./enhanced-memory-utils');

async function reproduceOriginalFindIssue() {
    console.log('🔍 AZURE PIPELINES find() MEMORY CRASH REPRODUCTION');
    console.log('====================================================');
    
    // Check if we're running with restricted memory
    const memoryLimit = process.env.NODE_OPTIONS?.includes('max-old-space-size') || 
                       process.execArgv.some(arg => arg.includes('max-old-space-size'));
    
    if (memoryLimit) {
        console.log('✅ Running with restricted heap size - crash likely!');
    } else {
        console.log('⚠️  No memory restriction detected.');
        console.log('💡 For guaranteed crash, run with: node --max-old-space-size=256 repro_original_find_issue.js');
    }
    
    // Use the largest available directory to maximize memory pressure
    const testPaths = [
        // 'C:\\RISHABH\\ADO\\Test',  // All 1.2M files - guaranteed crash
        'C:\\RISHABH\\ADO\\Test\\level_2\\level_3\\level_4\\level_5\\level_6\\level_7', // 40k files
        'C:\\RISHABH\\ADO\\Test\\level_2\\level_3\\level_4\\level_5\\level_6\\level_7\\level_8\\level_9\\level_10', // 80k files
        'C:\\RISHABH\\ADO\\Test\\level_2\\level_3\\level_4\\level_5\\level_6\\level_7\\level_8\\level_9', // 40k files
    ];
    
    let testPath = null;
    let estimatedFiles = 0;
    
    // Find the largest available test directory
    for (const path of testPaths) {
        if (fs.existsSync(path)) {
            testPath = path;
            if (path.includes('level_10')) estimatedFiles = 80000;
            else if (path.includes('level_9')) estimatedFiles = 40000;
            else estimatedFiles = 1200000; // Full test directory
            break;
        }
    }
    
    if (!testPath) {
        console.log('❌ No test directories found!');
        return;
    }
    
    console.log(`\n📁 Test Directory: ${testPath}`);
    console.log(`📊 Estimated Files: ${estimatedFiles.toLocaleString()}`);
    
    if (estimatedFiles > 500000) {
        console.log('🚨 WARNING: Testing with 1.2M files - crash highly likely!');
    } else if (estimatedFiles > 50000 && memoryLimit) {
        console.log('⚠️  Testing with restricted memory - crash possible');
    } else {
        console.log('� May need memory restriction to trigger crash');
    }
    
    // Test Original Find Function (with aggressive memory monitoring)
    console.log('\n🔬 TESTING: Original find() Function (Memory Crash Test)');
    console.log('========================================================');
    await testOriginalFindForCrash(testPath, estimatedFiles);
    
    // Summary
    console.log('\n📋 CRASH TEST RESULTS');
    console.log('======================');
    console.log('✨ This test helps us:');
    console.log('   1. Reproduce the exact crash scenario');
    console.log('   2. Validate our optimized approach works where original fails');
    console.log('   3. Measure memory usage patterns that cause crashes');
    console.log('');
    console.log('💡 NEXT: Test optimized approach with same scenario');
}

async function testOriginalFindForCrash(testPath, estimatedFiles) {
    const memorySnapshots = [];
    let monitoringActive = true;
    
    // Get initial memory info and heap limit
    const initialMem = getProcessMemoryUsage();
    const v8 = require('v8');
    const heapStats = v8.getHeapStatistics();
    const heapLimit = Math.round(heapStats.heap_size_limit / 1024 / 1024);
    
    console.log(`🔧 Node.js Heap Limit: ${heapLimit}MB`);
    console.log(`📊 Initial Memory: RSS=${initialMem.rss}MB, Heap=${initialMem.heapUsed}MB`);
    
    if (heapLimit < 1000) {
        console.log('✅ Restricted heap detected - crash likely!');
    } else if (estimatedFiles > 500000) {
        console.log('✅ Large dataset detected - crash possible even with full memory');
    } else {
        console.log('⚠️  May not crash with current settings');
    }
    
    // Aggressive memory monitoring every 2 seconds
    const monitor = setInterval(() => {
        if (!monitoringActive) return;
        
        const mem = getProcessMemoryUsage();
        const heap = v8.getHeapStatistics();
        const heapUsedPercent = Math.round((heap.used_heap_size / heap.heap_size_limit) * 100);
        
        memorySnapshots.push({
            time: Date.now(),
            rss: mem.rss,
            heapUsed: mem.heapUsed,
            heapTotal: mem.heapTotal,
            heapPercent: heapUsedPercent
        });
        
        console.log(`📊 Memory: RSS=${mem.rss}MB, Heap=${mem.heapUsed}MB (${heapUsedPercent}% of limit)`);
        
        // Warn when approaching heap limit
        if (heapUsedPercent > 80) {
            console.log('🚨 WARNING: Approaching heap limit! Crash imminent!');
        }
    }, 2000);
    
    try {
        console.log('\n⏱️  Starting original find() function...');
        console.log('🚨 WARNING: This SHOULD crash with "heap out of memory"!');
        console.log('📈 Watch memory usage climb until crash...');
        
        const startTime = Date.now();
        const startMem = getProcessMemoryUsage();
        
        // Add memory pressure by pre-allocating some arrays (simulates real-world conditions)
        const memoryPressure = [];
        for (let i = 0; i < 1000; i++) {
            memoryPressure.push(new Array(1000).fill('memory pressure'));
        }
        
        console.log(`📊 Starting find() with memory pressure applied...`);
        
        const results = tl.find(testPath);
        
        const endTime = Date.now();
        const endMem = getProcessMemoryUsage();
        
        monitoringActive = false;
        clearInterval(monitor);
        
        const duration = endTime - startTime;
        const memoryGrowth = endMem.rss - startMem.rss;
        
        console.log(`\n📈 ORIGINAL FIND() RESULTS:`);
        console.log(`   Files Found: ${results.length.toLocaleString()}`);
        console.log(`   Duration: ${(duration / 1000).toFixed(1)} seconds`);
        console.log(`   Initial RSS: ${startMem.rss} MB`);
        console.log(`   Final RSS: ${endMem.rss} MB`);
        console.log(`   Memory Growth: +${memoryGrowth} MB`);
        console.log(`   Performance: ${Math.round(results.length / (duration / 1000))} files/sec`);
        
        // Show memory growth pattern
        if (memorySnapshots.length > 3) {
            console.log(`\n📊 Memory Growth Pattern:`);
            const samples = memorySnapshots.slice(0, 5); // Show first 5 samples
            samples.forEach((snapshot, i) => {
                console.log(`   ${i === 0 ? '🟢' : '📈'} RSS: ${snapshot.rss} MB (${i * 5}s)`);
            });
            
            if (memorySnapshots.length > 5) {
                console.log(`   ... (${memorySnapshots.length - 5} more samples)`);
                const lastSample = memorySnapshots[memorySnapshots.length - 1];
                console.log(`   💥 Final: ${lastSample.rss} MB`);
            }
        }
        
        // Performance analysis
        if (duration > 60000) { // More than 1 minute
            console.log(`\n⚠️  PERFORMANCE ISSUE CONFIRMED:`);
            console.log(`   - Duration of ${(duration / 1000).toFixed(1)}s is unacceptable`);
            console.log(`   - This would timeout in most CI/CD systems`);
            console.log(`   - Memory usage grew by ${memoryGrowth}MB`);
        }
        
    } catch (error) {
        monitoringActive = false;
        clearInterval(monitor);
        
        console.log(`\n💥 CRASHED: ${error.message}`);
        console.log('🎯 SUCCESS! Reproduced the memory crash issue!');
        
        if (error.message.includes('heap out of memory')) {
            console.log('✅ CONFIRMED: "JavaScript heap out of memory" crash');
            console.log('📊 This is the exact error that occurs in Azure Pipelines!');
        } else if (error.message.includes('Maximum call stack size exceeded')) {
            console.log('✅ CONFIRMED: Stack overflow due to deep recursion');
        } else {
            console.log(`❌ Different error: ${error.message}`);
        }
        
        // Show memory progression before crash
        if (memorySnapshots.length > 0) {
            console.log(`\n📊 Memory Growth Before Crash:`);
            const samples = memorySnapshots.slice(Math.max(0, memorySnapshots.length - 5));
            samples.forEach((snapshot, i) => {
                const elapsed = Math.round((snapshot.time - memorySnapshots[0].time) / 1000);
                console.log(`   ${elapsed}s: RSS=${snapshot.rss}MB, Heap=${snapshot.heapUsed}MB (${snapshot.heapPercent}%)`);
            });
            
            const maxHeap = Math.max(...memorySnapshots.map(s => s.heapPercent));
            console.log(`\n📈 Peak heap usage: ${maxHeap}% of limit before crash`);
        }
        
        console.log('\n🧪 CRASH SCENARIO ESTABLISHED:');
        console.log(`   - Dataset: ${estimatedFiles.toLocaleString()} files`);
        console.log(`   - Heap Limit: ${heapLimit}MB`);
        console.log(`   - Error: ${error.message.substring(0, 50)}...`);
        console.log('   - This exact scenario can now be tested with optimized approach!');
    }
}

// Helper function to show run commands
function showRunInstructions() {
    console.log('\n💡 HOW TO GUARANTEE MEMORY CRASH:');
    console.log('==================================');
    console.log('1. For aggressive crash (recommended):');
    console.log('   node --max-old-space-size=256 repro_original_find_issue.js');
    console.log('');
    console.log('2. For moderate crash:');
    console.log('   node --max-old-space-size=512 repro_original_find_issue.js');
    console.log('');
    console.log('3. For normal run (may not crash):');
    console.log('   node repro_original_find_issue.js');
    console.log('');
    console.log('📊 Lower memory = higher crash probability');
}

// Show instructions if no memory limit detected
const hasMemoryLimit = process.execArgv.some(arg => arg.includes('max-old-space-size')) ||
                      process.env.NODE_OPTIONS?.includes('max-old-space-size');

if (!hasMemoryLimit) {
    showRunInstructions();
    process.exit(0);
}

// Run the reproduction
reproduceOriginalFindIssue().catch(console.error);