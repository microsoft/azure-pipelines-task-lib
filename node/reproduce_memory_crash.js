/**
 * Reproduce "JavaScript heap out of memory" crash with Original find() function
 * 
 * This test demonstrates the memory issue that crashes Azure Pipelines tasks
 * by running the original find() with restricted memory limits.
 */

const tl = require('./_build/task');
const path = require('path');
const fs = require('fs');

async function reproduceMemoryCrash() {
    console.log('🔥 REPRODUCING "JavaScript heap out of memory" CRASH');
    console.log('====================================================');
    
    // Test paths from your directory structure
    const testPaths = [
        {
            name: '100k files',
            path: 'C:\\RISHABH\\ADO\\Test\\level_2\\level_3\\level_4\\level_5\\level_6\\level_7\\level_8\\level_9\\level_10',
            expectedFiles: 100000
        },
        {
            name: '200k files', 
            path: 'C:\\RISHABH\\ADO\\Test\\level_2\\level_3\\level_4\\level_5\\level_6\\level_7\\level_8\\level_9',
            expectedFiles: 200000
        }
    ];
    
    console.log(`🖥️  System: Node.js ${process.version}`);
    console.log(`🧠 Heap Limit: ${Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024)} MB`);
    console.log(`💾 Current Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB RSS`);
    console.log('');
    
    for (const test of testPaths) {
        console.log(`🎯 Testing: ${test.name} (${test.expectedFiles.toLocaleString()} expected)`);
        console.log(`📁 Path: ${test.path}`);
        
        // Verify path exists
        if (!fs.existsSync(test.path)) {
            console.log(`❌ Path does not exist: ${test.path}`);
            console.log('   Make sure the test directory structure is created');
            continue;
        }
        
        // Check directory size
        try {
            const items = fs.readdirSync(test.path);
            console.log(`📊 Actual items in directory: ${items.length.toLocaleString()}`);
        } catch (error) {
            console.log(`⚠️  Cannot read directory: ${error.message}`);
            continue;
        }
        
        // Monitor memory before
        const memBefore = process.memoryUsage();
        console.log(`📈 Memory before: Heap ${Math.round(memBefore.heapUsed / 1024 / 1024)} MB, RSS ${Math.round(memBefore.rss / 1024 / 1024)} MB`);
        
        try {
            console.log('⏱️  Starting original find() - watch for memory crash...');
            const startTime = Date.now();
            
            // This should demonstrate high memory usage or crash
            const results = tl.find(test.path);
            
            const duration = Date.now() - startTime;
            const memAfter = process.memoryUsage();
            
            console.log(`✅ COMPLETED: ${results.length.toLocaleString()} files found in ${duration.toLocaleString()}ms`);
            console.log(`📈 Memory after: Heap ${Math.round(memAfter.heapUsed / 1024 / 1024)} MB, RSS ${Math.round(memAfter.rss / 1024 / 1024)} MB`);
            console.log(`📊 Memory growth: Heap +${Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024)} MB, RSS +${Math.round((memAfter.rss - memBefore.rss) / 1024 / 1024)} MB`);
            
            // Check if memory usage is dangerously high
            if (memAfter.heapUsed > 2 * 1024 * 1024 * 1024) { // > 2GB
                console.log('⚠️  WARNING: Memory usage is very high - this could crash with more files!');
            }
            
        } catch (error) {
            const memAfter = process.memoryUsage();
            console.log(`💥 CRASHED: ${error.message}`);
            console.log(`📈 Memory at crash: Heap ${Math.round(memAfter.heapUsed / 1024 / 1024)} MB, RSS ${Math.round(memAfter.rss / 1024 / 1024)} MB`);
            
            if (error.message.includes('heap out of memory')) {
                console.log('🎯 SUCCESS: Reproduced the exact "JavaScript heap out of memory" crash!');
                console.log('   This is the issue that breaks Azure Pipelines tasks');
            } else if (error.message.includes('Maximum call stack size exceeded')) {
                console.log('🎯 SUCCESS: Hit stack overflow - another memory-related crash!');
            }
        }
        
        console.log('');
        
        // Force garbage collection between tests
        if (global.gc) {
            global.gc();
            console.log('🗑️  Garbage collection performed');
        }
        
        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('-'.repeat(80));
    }
    
    console.log('');
    console.log('🔬 TEST ANALYSIS:');
    console.log('================');
    console.log('If you see high memory usage (>1GB) or crashes, this demonstrates:');
    console.log('1. Original find() has memory scaling issues');
    console.log('2. The function accumulates memory without proper cleanup');
    console.log('3. Large directories cause "JavaScript heap out of memory" crashes');
    console.log('4. This is exactly what breaks Azure Pipelines tasks');
    console.log('');
    console.log('💡 SOLUTION: Use Memory-Optimized approach instead!');
}

// Helper function for sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

reproduceMemoryCrash().catch(console.error);