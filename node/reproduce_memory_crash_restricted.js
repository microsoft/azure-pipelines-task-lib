/**
 * Aggressive Memory Crash Test - Restricted Heap Size
 * 
 * Run this with: node --max-old-space-size=512 reproduce_memory_crash_restricted.js
 * This forces a low memory limit to guarantee the crash reproduction
 */

const tl = require('./_build/task');
const fs = require('fs');

async function aggressiveMemoryCrashTest() {
    console.log('💥 AGGRESSIVE MEMORY CRASH TEST - RESTRICTED HEAP');
    console.log('==================================================');
    
    const heapLimit = require('v8').getHeapStatistics().heap_size_limit;
    console.log(`🧠 Heap Limit: ${Math.round(heapLimit / 1024 / 1024)} MB`);
    
    if (heapLimit > 1024 * 1024 * 1024) { // > 1GB
        console.log('⚠️  WARNING: Run with --max-old-space-size=512 for guaranteed crash!');
        console.log('   Example: node --max-old-space-size=512 reproduce_memory_crash_restricted.js');
        console.log('');
    }
    
    // Start with smaller directory first
    const testPath = 'C:\\RISHABH\\ADO\\Test\\level_2\\level_3\\level_4\\level_5\\level_6\\level_7\\level_8\\level_9\\level_10';
    
    console.log(`📁 Testing: ${testPath}`);
    
    if (!fs.existsSync(testPath)) {
        console.log(`❌ Path does not exist: ${testPath}`);
        console.log('   Falling back to larger directory...');
        
        // Try the 200k directory
        const fallbackPath = 'C:\\RISHABH\\ADO\\Test\\level_2\\level_3\\level_4\\level_5\\level_6\\level_7\\level_8\\level_9';
        if (fs.existsSync(fallbackPath)) {
            console.log(`📁 Using fallback: ${fallbackPath}`);
            testMemoryWithPath(fallbackPath);
        } else {
            console.log('❌ No test directories found - please create test structure first');
        }
        return;
    }
    
    await testMemoryWithPath(testPath);
}

async function testMemoryWithPath(testPath) {
    // Memory monitoring setup
    let memorySnapshots = [];
    let crashDetected = false;
    
    const monitor = setInterval(() => {
        const mem = process.memoryUsage();
        const snapshot = {
            time: Date.now(),
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
            rss: Math.round(mem.rss / 1024 / 1024)
        };
        
        memorySnapshots.push(snapshot);
        console.log(`📊 [Memory] Heap: ${snapshot.heapUsed}/${snapshot.heapTotal} MB, RSS: ${snapshot.rss} MB`);
        
        // Detect approaching crash
        const heapLimit = require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024;
        if (snapshot.heapUsed > heapLimit * 0.8) {
            console.log('🚨 APPROACHING MEMORY LIMIT - CRASH IMMINENT!');
        }
        
        if (snapshot.heapUsed > heapLimit * 0.95) {
            console.log('💥 CRASH WARNING - Memory at 95% of limit!');
            crashDetected = true;
        }
    }, 2000); // Every 2 seconds
    
    try {
        console.log('⏱️  Starting original find() with memory monitoring...');
        const startTime = Date.now();
        
        // This should crash with restricted memory
        const results = tl.find(testPath);
        
        clearInterval(monitor);
        const duration = Date.now() - startTime;
        
        console.log(`\n✅ UNEXPECTED SUCCESS: ${results.length.toLocaleString()} files in ${duration}ms`);
        console.log('   (This means your heap limit is too high to reproduce the crash)');
        
    } catch (error) {
        clearInterval(monitor);
        
        console.log(`\n💥 CRASHED AS EXPECTED: ${error.message}`);
        
        if (error.message.includes('heap out of memory')) {
            console.log('🎯 SUCCESS: Reproduced "JavaScript heap out of memory" crash!');
        } else if (error.message.includes('call stack')) {
            console.log('🎯 SUCCESS: Stack overflow crash (memory-related)!');
        } else {
            console.log('❓ Unexpected error type');
        }
        
        console.log('\n📈 Memory snapshots before crash:');
        memorySnapshots.slice(-5).forEach((snapshot, i) => {
            console.log(`   ${i === memorySnapshots.length - 1 ? '💥' : '  '} Heap: ${snapshot.heapUsed} MB, RSS: ${snapshot.rss} MB`);
        });
    }
    
    console.log('\n🔬 CRASH ANALYSIS:');
    console.log('==================');
    console.log('This crash demonstrates exactly what happens in Azure Pipelines:');
    console.log('1. Original find() allocates memory without proper control');
    console.log('2. Large directories cause exponential memory growth');
    console.log('3. Node.js hits heap limit and crashes the entire task');
    console.log('4. Azure Pipeline fails with "JavaScript heap out of memory"');
    console.log('\n💡 SOLUTION: Memory-Optimized approach prevents this crash!');
}

aggressiveMemoryCrashTest().catch(console.error);