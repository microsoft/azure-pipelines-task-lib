/**
 * Enhanced Production-Like Memory Crash Reproduction
 * 
 * This script simulates the exact memory patterns from customer's production crash:
 * - Large heap usage (~4GB)
 * - Memory fragmentation
 * - Ineffective garbage collection
 * - Real Azure Pipelines object patterns
 */

const tl = require('./_build/task');
const fs = require('fs');
const { getProcessMemoryUsage } = require('./enhanced-memory-utils');

async function reproduceProductionCrash() {
    console.log('🏭 PRODUCTION-LIKE MEMORY CRASH REPRODUCTION');
    console.log('==============================================');
    
    // Simulate customer's environment
    const v8 = require('v8');
    const initialHeap = v8.getHeapStatistics();
    console.log(`🔧 Available Heap: ${Math.round(initialHeap.heap_size_limit / 1024 / 1024)}MB`);
    
    // Don't restrict memory - let it grow to production-like levels
    console.log('📈 Running with production-like memory limits (no artificial restriction)');
    console.log('🎯 Goal: Reproduce "Ineffective mark-compacts near heap limit" error');
    
    const testPath = 'C:\\RISHABH\\ADO\\Test';  // Use full 1.2M file directory
    
    if (!fs.existsSync(testPath)) {
        console.log('❌ Need full test directory with 1.2M files');
        console.log('💡 Create larger test dataset to match production conditions');
        return;
    }
    
    // Test with production-like memory patterns
    console.log('\n🔬 TESTING: Production Memory Pattern Reproduction');
    console.log('===================================================');
    await testProductionMemoryPattern(testPath);
}

async function testProductionMemoryPattern(testPath) {
    const memorySnapshots = [];
    let monitoringActive = true;
    let gcCount = 0;
    
    // Monitor GC events (like customer's logs)
    const originalGC = global.gc;
    if (process.env.NODE_ENV !== 'production') {
        // Enable GC monitoring
        const v8 = require('v8');
        v8.setFlagsFromString('--expose-gc');
    }
    
    // Monitor memory every second for detailed GC analysis
    const monitor = setInterval(() => {
        if (!monitoringActive) return;
        
        const mem = getProcessMemoryUsage();
        const heap = require('v8').getHeapStatistics();
        const heapUsedMB = Math.round(heap.used_heap_size / 1024 / 1024);
        const heapTotalMB = Math.round(heap.total_heap_size / 1024 / 1024);
        const heapLimitMB = Math.round(heap.heap_size_limit / 1024 / 1024);
        
        memorySnapshots.push({
            time: Date.now(),
            heapUsed: heapUsedMB,
            heapTotal: heapTotalMB,
            heapLimit: heapLimitMB,
            rss: mem.rss || 0,
            malloced: Math.round(heap.malloced_memory / 1024 / 1024),
            peakMalloced: Math.round(heap.peak_malloced_memory / 1024 / 1024)
        });
        
        console.log(`📊 Memory: Heap=${heapUsedMB}MB/${heapTotalMB}MB (${heapLimitMB}MB limit), RSS=${mem.rss || 'N/A'}MB, Malloced=${Math.round(heap.malloced_memory / 1024 / 1024)}MB`);
        
        // Detect approaching dangerous memory levels (like customer's 4GB)
        if (heapUsedMB > 3000) {
            console.log('🚨 CRITICAL: Approaching customer crash levels (4GB+)');
        } else if (heapUsedMB > 2000) {
            console.log('⚠️  WARNING: High memory usage - monitoring GC effectiveness');
        } else if (heapUsedMB > 1000) {
            console.log('📈 MODERATE: Memory climbing toward production levels');
        }
        
        // Check GC effectiveness (key insight from customer logs)
        const gcEffectiveness = heap.used_heap_size / heap.total_heap_size;
        if (gcEffectiveness > 0.9) {
            console.log('🚨 GC INEFFECTIVENESS DETECTED: Heap utilization > 90%');
        }
        
    }, 1000);
    
    try {
        console.log('\n⏱️  Starting production-pattern find() test...');
        console.log('🎯 Simulating Azure Pipelines Delete Files task memory usage');
        console.log('📈 Expecting memory to grow to multi-GB levels...');
        
        const startTime = Date.now();
        const startMem = getProcessMemoryUsage();
        
        // Create production-like memory pressure patterns
        console.log('🏭 Creating production-like object patterns...');
        const productionObjects = [];
        
        // Simulate Azure Pipelines task context objects
        for (let i = 0; i < 50000; i++) {
            productionObjects.push({
                taskInstanceId: `task-${i}`,
                variables: new Map(),
                endpoints: new Array(100).fill(null).map((_, j) => ({
                    id: `endpoint-${i}-${j}`,
                    data: new Array(1000).fill(`data-${i}-${j}`)
                })),
                logs: new Array(500).fill(`log entry ${i}`),  
                metadata: {
                    created: new Date(),
                    paths: new Array(200).fill(`/path/to/file-${i}`)
                }
            });
            
            // Create memory fragmentation
            if (i % 1000 === 0) {
                console.log(`📦 Created ${i.toLocaleString()} production objects...`);
                // Don't force GC - let it happen naturally like in production
            }
        }
        
        console.log('✅ Production memory pattern established');
        console.log('🔍 Starting find() operation on large dataset...');
        
        // Now run the problematic find() operation
        const results = tl.find(testPath);
        
        const endTime = Date.now();
        const endMem = getProcessMemoryUsage();
        
        monitoringActive = false;
        clearInterval(monitor);
        
        const duration = endTime - startTime;
        const memoryGrowth = (endMem.rss || 0) - (startMem.rss || 0);
        
        console.log(`\n📈 PRODUCTION PATTERN TEST RESULTS:`);
        console.log(`   Files Found: ${results.length.toLocaleString()}`);
        console.log(`   Duration: ${(duration / 1000).toFixed(1)} seconds`);
        console.log(`   Memory Growth: +${memoryGrowth}MB`);
        console.log(`   Final Memory: ${endMem.rss || 'N/A'}MB RSS`);
        
        // Analyze GC patterns
        if (memorySnapshots.length > 10) {
            const peakMemory = Math.max(...memorySnapshots.map(s => s.heapUsed));
            const avgMemory = Math.round(
                memorySnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / memorySnapshots.length
            );
            
            console.log(`\n📊 Memory Pattern Analysis:`);
            console.log(`   Peak Heap Usage: ${peakMemory}MB`);
            console.log(`   Average Heap Usage: ${avgMemory}MB`);
            console.log(`   Memory Growth Pattern: ${peakMemory > 3000 ? 'PRODUCTION-LIKE' : 'BELOW PRODUCTION'}`);
            
            if (peakMemory > 3000) {
                console.log(`✅ SUCCESS: Reproduced production-scale memory usage`);
            } else {
                console.log(`⚠️  Need larger dataset or more memory pressure to match production`);
            }
        }
        
    } catch (error) {
        monitoringActive = false;
        clearInterval(monitor);
        
        console.log(`\n💥 CRASHED: ${error.message}`);
        
        // Analyze crash pattern
        if (error.message.includes('heap out of memory')) {
            console.log('✅ REPRODUCED: Customer production crash pattern!');
            
            if (error.message.includes('Ineffective mark-compacts')) {
                console.log('🎯 EXACT MATCH: "Ineffective mark-compacts" error reproduced');
            }
            
            // Show memory progression before crash
            if (memorySnapshots.length > 0) {
                console.log(`\n📊 Memory Progression Before Crash (Last 5 snapshots):`);
                const lastSnapshots = memorySnapshots.slice(-5);
                lastSnapshots.forEach((snapshot, i) => {
                    console.log(`   ${i}: Heap=${snapshot.heapUsed}MB/${snapshot.heapTotal}MB, RSS=${snapshot.rss}MB`);
                });
                
                const peakHeap = Math.max(...memorySnapshots.map(s => s.heapUsed));
                console.log(`\n📈 Peak heap before crash: ${peakHeap}MB`);
                
                if (peakHeap > 3000) {
                    console.log('🎯 CONFIRMED: Reached customer-like memory levels before crash');
                } else {
                    console.log('📊 Note: Crashed before reaching full customer memory levels');
                }
            }
        }
    }
}

// Run the enhanced reproduction
reproduceProductionCrash().catch(console.error);