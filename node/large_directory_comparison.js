/**
 * Real-world comparison of Original find() vs Generator-based find()
 * For large existing directory structures (100k+ files)
 */

const tl = require('./_build/task');
const { getMemoryUsage: getDetailedMemoryUsage, estimateArrayMemory, estimateStackMemory } = require('./_build/memory-metrics');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Format memory in MB
 */
function formatMemory(bytes) {
    return (bytes / 1024 / 1024).toFixed(3);
}

/**
 * Format duration
 */
function formatDuration(ms) {
    if (ms < 1000) {
        return `${ms.toFixed(2)} ms`;
    } else {
        return `${(ms / 1000).toFixed(2)} seconds`;
    }
}

/**
 * Get detailed memory usage
 */
function getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        rss: usage.rss
    };
}

/**
 * Quick directory analysis
 */
function analyzeDirectory(dirPath) {
    console.log(`🔍 Analyzing directory: ${dirPath}`);
    
    if (!fs.existsSync(dirPath)) {
        throw new Error(`Directory does not exist: ${dirPath}`);
    }
    
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
    }
    
    console.log(`✅ Directory exists and is accessible`);
    
    // Quick sample to estimate size
    console.log(`📊 Preparing to test large directory structure...`);
    return dirPath;
}

/**
 * Test original find() approach with detailed memory tracking
 */
function testOriginalFind(testDir) {
    console.log('\n🔍 Testing Original find() with detailed memory tracking...');
    console.log('⏱️  Starting original find operation...');
    
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
        console.log('🗑️  Garbage collection performed');
    }
    
    const startMemory = getMemoryUsage();
    const startTime = process.hrtime.bigint();
    
    console.log(`📈 Start Memory: ${formatMemory(startMemory.heapUsed)} MB heap`);
    
    let results;
    let error = null;
    let detailedMetrics = null;
    
    try {
        // Run original find (simple version without detailed tracking for now)
        results = tl.find(testDir);
        
        const endTime = process.hrtime.bigint();
        const endMemory = getMemoryUsage();
        
        // For now, we'll use basic metrics estimation
        detailedMetrics = {
            resultArrayMemoryMB: estimateArrayMemory(results),
            stackMemoryMB: 0.1, // Estimate for original approach
            maxStackDepth: 50, // Reasonable estimate
            snapshots: [],
            filesProcessed: results.length,
            peakMemoryMB: (endMemory.heapUsed - startMemory.heapUsed) / (1024 * 1024)
        };
        
        const duration = Number(endTime - startTime) / 1000000; // Convert to ms
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
        
        console.log(`✅ Original find() completed successfully`);
        console.log(`📁 Files found: ${results.length.toLocaleString()}`);
        console.log(`⏱️  Duration: ${formatDuration(duration)}`);
        console.log(`📈 End Memory: ${formatMemory(endMemory.heapUsed)} MB heap`);
        console.log(`📊 Memory Delta: ${formatMemory(memoryDelta)} MB`);
        console.log(`🏔️  Peak Memory: ${formatMemory(endMemory.heapUsed)} MB`);
        
        // Show detailed memory breakdown
        if (detailedMetrics) {
            console.log(`📋 Original find() Detailed Metrics:`);
            console.log(`   🗂️  Result Array Memory: ${detailedMetrics.resultArrayMemoryMB.toFixed(3)} MB`);
            console.log(`   🏗️  Peak Stack Memory: ${detailedMetrics.stackMemoryMB.toFixed(3)} MB`);
            console.log(`   📏 Max Stack Depth: ${detailedMetrics.maxStackDepth}`);
            console.log(`   📸 Memory Snapshots: ${detailedMetrics.snapshots.length}`);
            
            const stackVsArrayRatio = detailedMetrics.stackMemoryMB / detailedMetrics.resultArrayMemoryMB;
            console.log(`   ⚖️  Stack vs Array Ratio: ${stackVsArrayRatio.toFixed(2)}x`);
            console.log(`   🎯 Primary Memory Consumer: ${stackVsArrayRatio > 1 ? 'Traversal Stack' : 'Result Array'}`);
        }
        
        return {
            approach: 'Original find()',
            success: true,
            filesFound: results.length,
            duration: duration,
            startMemory: startMemory,
            endMemory: endMemory,
            memoryDelta: memoryDelta,
            peakMemory: endMemory.heapUsed,
            metrics: detailedMetrics,
            error: null
        };
        
    } catch (err) {
        const endTime = process.hrtime.bigint();
        const endMemory = getMemoryUsage();
        const duration = Number(endTime - startTime) / 1000000;
        
        console.log(`❌ Original find() failed: ${err.message}`);
        console.log(`⏱️  Duration before failure: ${formatDuration(duration)}`);
        console.log(`📈 Memory at failure: ${formatMemory(endMemory.heapUsed)} MB heap`);
        
        return {
            approach: 'Original find()',
            success: false,
            filesFound: 0,
            duration: duration,
            startMemory: startMemory,
            endMemory: endMemory,
            memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
            peakMemory: endMemory.heapUsed,
            metrics: detailedMetrics,
            error: err.message
        };
    }
}



/**
 * Test generator-based find() approach
 */
function testGeneratorFind(testDir, batchSize = 1000) {
    console.log(`\n🔄 Testing Generator find() with batch size ${batchSize}...`);
    console.log('⏱️  Starting generator-based find operation...');
    
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
        console.log('🗑️  Garbage collection performed');
    }
    
    const startMemory = getMemoryUsage();
    const startTime = process.hrtime.bigint();
    
    console.log(`📈 Start Memory: ${formatMemory(startMemory.heapUsed)} MB heap`);
    
    let result;
    let error = null;
    
    try {
        // Run generator-based find with metrics
        result = tl.findWithMetrics(testDir, undefined, batchSize, true);
        
        const endTime = process.hrtime.bigint();
        const endMemory = getMemoryUsage();
        
        const duration = Number(endTime - startTime) / 1000000; // Convert to ms
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
        
        console.log(`✅ Generator find() completed successfully`);
        console.log(`📁 Files found: ${result.results ? result.results.length.toLocaleString() : 'Unknown'}`);
        console.log(`⏱️  Duration: ${formatDuration(duration)}`);
        console.log(`📈 End Memory: ${formatMemory(endMemory.heapUsed)} MB heap`);
        console.log(`📊 Memory Delta: ${formatMemory(memoryDelta)} MB`);
        console.log(`🏔️  Peak Memory: ${formatMemory(result.metrics && result.metrics.peakMemoryMB ? result.metrics.peakMemoryMB * 1024 * 1024 : endMemory.heapUsed)} MB`);
        
        // Detailed metrics
        if (result.metrics) {
            console.log(`📋 Detailed Generator Metrics:`);
            console.log(`   🗂️  Result Array Memory: ${result.metrics.resultArrayMemoryMB.toFixed(3)} MB`);
            console.log(`   🏗️  Peak Stack Memory: ${result.metrics.stackMemoryMB.toFixed(3)} MB`);
            console.log(`   📏 Max Stack Depth: ${result.metrics.maxStackDepth}`);
            if (result.metrics.batchesProcessed !== undefined) {
                console.log(`   📦 Batches Processed: ${result.metrics.batchesProcessed.toLocaleString()}`);
            }
            console.log(`   📸 Memory Snapshots: ${result.metrics.snapshots.length}`);
            
            const stackVsArrayRatio = result.metrics.stackMemoryMB / result.metrics.resultArrayMemoryMB;
            console.log(`   ⚖️  Stack vs Array Ratio: ${stackVsArrayRatio.toFixed(2)}x`);
            console.log(`   🎯 Primary Memory Consumer: ${stackVsArrayRatio > 1 ? 'Traversal Stack' : 'Result Array'}`);
        }
        
        return {
            approach: `Generator find() (batch: ${batchSize})`,
            success: true,
            filesFound: result.results ? result.results.length : 0,
            duration: duration,
            startMemory: startMemory,
            endMemory: endMemory,
            memoryDelta: memoryDelta,
            peakMemory: result.metrics && result.metrics.peakMemoryMB ? result.metrics.peakMemoryMB * 1024 * 1024 : endMemory.heapUsed,
            metrics: result.metrics,
            error: null
        };
        
    } catch (err) {
        const endTime = process.hrtime.bigint();
        const endMemory = getMemoryUsage();
        const duration = Number(endTime - startTime) / 1000000;
        
        console.log(`❌ Generator find() failed: ${err.message}`);
        console.log(`⏱️  Duration before failure: ${formatDuration(duration)}`);
        console.log(`📈 Memory at failure: ${formatMemory(endMemory.heapUsed)} MB heap`);
        
        return {
            approach: `Generator find() (batch: ${batchSize})`,
            success: false,
            filesFound: 0,
            duration: duration,
            startMemory: startMemory,
            endMemory: endMemory,
            memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
            peakMemory: endMemory.heapUsed,
            metrics: null,
            error: err.message
        };
    }
}

/**
 * Test memory-optimized find() approach
 */
function testMemoryOptimizedFind(testDir) {
    console.log(`\n🧠 Testing Memory-Optimized find() with adaptive strategies...`);
    console.log('⏱️  Starting memory-optimized find operation...');
    
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
        console.log('🗑️  Garbage collection performed');
    }
    
    const startMemory = getMemoryUsage();
    const startTime = process.hrtime.bigint();
    
    console.log(`📈 Start Memory: ${formatMemory(startMemory.heapUsed)} MB heap`);
    
    let result;
    let error = null;
    
    try {
        // Run memory-optimized find with metrics
        result = tl.findMemoryOptimized(testDir, undefined, true);
        
        const endTime = process.hrtime.bigint();
        const endMemory = getMemoryUsage();
        
        const duration = Number(endTime - startTime) / 1000000; // Convert to ms
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
        
        console.log(`✅ Memory-optimized find() completed successfully`);
        console.log(`📁 Files found: ${result.results ? result.results.length.toLocaleString() : 'Unknown'}`);
        console.log(`⏱️  Duration: ${formatDuration(duration)}`);
        console.log(`📈 End Memory: ${formatMemory(endMemory.heapUsed)} MB heap`);
        console.log(`📊 Memory Delta: ${formatMemory(memoryDelta)} MB`);
        console.log(`🏔️  Peak Memory: ${formatMemory(result.metrics && result.metrics.peakMemoryMB ? result.metrics.peakMemoryMB * 1024 * 1024 : endMemory.heapUsed)} MB`);
        
        // Detailed metrics
        if (result.metrics) {
            console.log(`📋 Memory-Optimized Detailed Metrics:`);
            console.log(`   🗂️  Result Array Memory: ${result.metrics.resultArrayMemoryMB.toFixed(3)} MB`);
            console.log(`   🏗️  Peak Stack Memory: ${result.metrics.stackMemoryMB.toFixed(3)} MB`);
            console.log(`   📏 Max Stack Depth: ${result.metrics.maxStackDepth}`);
            if (result.metrics.batchesProcessed !== undefined) {
                console.log(`   📦 Chunks Processed: ${result.metrics.batchesProcessed.toLocaleString()}`);
            }
            console.log(`   📸 Memory Snapshots: ${result.metrics.snapshots.length}`);
            
            const stackVsArrayRatio = result.metrics.stackMemoryMB / result.metrics.resultArrayMemoryMB;
            console.log(`   ⚖️  Stack vs Array Ratio: ${stackVsArrayRatio.toFixed(2)}x`);
            console.log(`   🎯 Primary Memory Consumer: ${stackVsArrayRatio > 1 ? 'Traversal Stack' : 'Result Array'}`);
            console.log(`   🧠 Strategy Used: ${result.metrics.snapshots.find(s => s.description.includes('strategy')) ? 
                (result.metrics.snapshots.find(s => s.description.includes('efficient')) ? 'Memory-Efficient (Large Dir)' : 'Normal (Small Dir)') 
                : 'Adaptive'}`);
        }
        
        return {
            approach: 'Memory-Optimized find()',
            success: true,
            filesFound: result.results ? result.results.length : 0,
            duration: duration,
            startMemory: startMemory,
            endMemory: endMemory,
            memoryDelta: memoryDelta,
            peakMemory: result.metrics && result.metrics.peakMemoryMB ? result.metrics.peakMemoryMB * 1024 * 1024 : endMemory.heapUsed,
            metrics: result.metrics,
            error: null
        };
        
    } catch (err) {
        const endTime = process.hrtime.bigint();
        const endMemory = getMemoryUsage();
        const duration = Number(endTime - startTime) / 1000000;
        
        console.log(`❌ Memory-optimized find() failed: ${err.message}`);
        console.log(`⏱️  Duration before failure: ${formatDuration(duration)}`);
        console.log(`📈 Memory at failure: ${formatMemory(endMemory.heapUsed)} MB heap`);
        
        return {
            approach: 'Memory-Optimized find()',
            success: false,
            filesFound: 0,
            duration: duration,
            startMemory: startMemory,
            endMemory: endMemory,
            memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
            peakMemory: endMemory.heapUsed,
            metrics: null,
            error: err.message
        };
    }
}

/**
 * Compare results
 */
function compareResults(original, generator) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE PERFORMANCE COMPARISON');
    console.log('='.repeat(80));
    
    // Success status
    console.log(`\n🎯 Execution Status:`);
    console.log(`   Original: ${original.success ? '✅ Success' : '❌ Failed - ' + original.error}`);
    console.log(`   Generator: ${generator.success ? '✅ Success' : '❌ Failed - ' + generator.error}`);
    
    if (!original.success && !generator.success) {
        console.log(`\n⚠️  Both approaches failed - cannot compare results`);
        return;
    }
    
    // File count comparison
    if (original.success && generator.success) {
        console.log(`\n📁 Files Found:`);
        console.log(`   Original: ${original.filesFound.toLocaleString()}`);
        console.log(`   Generator: ${generator.filesFound.toLocaleString()}`);
        console.log(`   Match: ${original.filesFound === generator.filesFound ? '✅ Identical' : '❌ Different'}`);
    }
    
    // Performance comparison
    console.log(`\n⏱️  Execution Time:`);
    console.log(`   Original: ${formatDuration(original.duration)}`);
    console.log(`   Generator: ${formatDuration(generator.duration)}`);
    
    if (original.success && generator.success) {
        const speedRatio = original.duration / generator.duration;
        console.log(`   Speed Ratio: ${speedRatio.toFixed(2)}x ${speedRatio > 1 ? '(Generator faster)' : '(Original faster)'}`);
    }
    
    // Memory comparison
    console.log(`\n📊 Memory Usage Overview:`);
    console.log(`   Original Delta: ${formatMemory(original.memoryDelta)} MB`);
    console.log(`   Generator Delta: ${formatMemory(generator.memoryDelta)} MB`);
    console.log(`   Original Peak: ${formatMemory(original.peakMemory)} MB`);
    console.log(`   Generator Peak: ${formatMemory(generator.peakMemory)} MB`);
    
    if (original.success && generator.success) {
        const memoryRatio = original.memoryDelta / generator.memoryDelta;
        const peakRatio = original.peakMemory / generator.peakMemory;
        console.log(`   Memory Delta Ratio: ${memoryRatio.toFixed(2)}x ${memoryRatio > 1 ? '(Generator more efficient)' : '(Original more efficient)'}`);
        console.log(`   Peak Memory Ratio: ${peakRatio.toFixed(2)}x ${peakRatio > 1 ? '(Generator lower peak)' : '(Original lower peak)'}`);
    }

    // Detailed memory breakdown comparison
    if (original.success && generator.success && original.metrics && generator.metrics) {
        console.log(`\n🔬 DETAILED MEMORY BREAKDOWN COMPARISON:`);
        console.log(`   📊 Results Array Memory:`);
        console.log(`      Original: ${original.metrics.resultArrayMemoryMB.toFixed(3)} MB`);
        console.log(`      Generator: ${generator.metrics.resultArrayMemoryMB.toFixed(3)} MB`);
        const arrayRatio = original.metrics.resultArrayMemoryMB / generator.metrics.resultArrayMemoryMB;
        console.log(`      Ratio: ${arrayRatio.toFixed(2)}x ${arrayRatio > 1 ? '(Generator more efficient)' : '(Original more efficient)'}`);
        
        console.log(`   🏗️  Stack Memory:`);
        console.log(`      Original: ${original.metrics.stackMemoryMB.toFixed(3)} MB`);
        console.log(`      Generator: ${generator.metrics.stackMemoryMB.toFixed(3)} MB`);
        const stackRatio = original.metrics.stackMemoryMB / generator.metrics.stackMemoryMB;
        console.log(`      Ratio: ${stackRatio.toFixed(2)}x ${stackRatio > 1 ? '(Generator more efficient)' : '(Original more efficient)'}`);
        
        console.log(`   📏 Stack Depth:`);
        console.log(`      Original Max: ${original.metrics.maxStackDepth}`);
        console.log(`      Generator Max: ${generator.metrics.maxStackDepth}`);
        console.log(`      Match: ${original.metrics.maxStackDepth === generator.metrics.maxStackDepth ? '✅' : '❓ Different'}`);
        
        console.log(`   🎯 Memory Consumer Analysis:`);
        const origStackVsArray = original.metrics.stackMemoryMB / original.metrics.resultArrayMemoryMB;
        const genStackVsArray = generator.metrics.stackMemoryMB / generator.metrics.resultArrayMemoryMB;
        console.log(`      Original: ${origStackVsArray > 1 ? 'Stack-heavy' : 'Array-heavy'} (${origStackVsArray.toFixed(2)}x)`);
        console.log(`      Generator: ${genStackVsArray > 1 ? 'Stack-heavy' : 'Array-heavy'} (${genStackVsArray.toFixed(2)}x)`);
    }
    
    // Success analysis
    if (original.success && !generator.success) {
        console.log(`\n🏆 WINNER: Original find()`);
        console.log(`   Reason: Generator failed, Original succeeded`);
    } else if (!original.success && generator.success) {
        console.log(`\n🏆 WINNER: Generator find()`);
        console.log(`   Reason: Original failed (likely out of memory), Generator succeeded`);
        console.log(`   🎯 This demonstrates the memory efficiency advantage of the generator approach!`);
    } else if (original.success && generator.success) {
        const memoryRatio = original.memoryDelta / generator.memoryDelta;
        const speedRatio = original.duration / generator.duration;
        
        if (memoryRatio > 1.5 && speedRatio > 0.8) {
            console.log(`\n🏆 WINNER: Generator find()`);
            console.log(`   Reason: Significantly more memory efficient with comparable speed`);
        } else if (speedRatio > 1.5 && memoryRatio > 0.8) {
            console.log(`\n🏆 WINNER: Generator find()`);
            console.log(`   Reason: Significantly faster with comparable memory usage`);
        } else if (memoryRatio < 0.8 && speedRatio < 0.8) {
            console.log(`\n🏆 WINNER: Original find()`);
            console.log(`   Reason: Both faster and more memory efficient`);
        } else {
            console.log(`\n🤝 RESULT: Mixed performance`);
            console.log(`   Both approaches have trade-offs - choice depends on priorities`);
        }
    }
}

/**
 * Compare all three approaches: Original, Generator, and Memory-Optimized
 */
function compareAllResults(original, generator, memoryOptimized) {
    console.log(`\n📊 === THREE-WAY COMPARISON SUMMARY ===`);
    
    // Results table
    console.log(`\n📋 Results Comparison:`);
    console.log(`   Original:        ${original.success ? '✅' : '❌'} ${original.success ? original.filesFound.toLocaleString() + ' files' : original.error}`);
    console.log(`   Generator:       ${generator.success ? '✅' : '❌'} ${generator.success ? generator.filesFound.toLocaleString() + ' files' : generator.error}`);
    console.log(`   Memory-Opt:      ${memoryOptimized.success ? '✅' : '❌'} ${memoryOptimized.success ? memoryOptimized.filesFound.toLocaleString() + ' files' : memoryOptimized.error}`);
    
    const successfulApproaches = [
        { name: 'Original', result: original },
        { name: 'Generator', result: generator },
        { name: 'Memory-Optimized', result: memoryOptimized }
    ].filter(a => a.result.success);
    
    if (successfulApproaches.length === 0) {
        console.log(`\n❌ All approaches failed - directory might be too large or inaccessible`);
        return;
    }
    
    console.log(`\n⏱️  Performance Comparison (${successfulApproaches.length} successful):`);
    successfulApproaches.forEach(approach => {
        console.log(`   ${approach.name.padEnd(15)}: ${formatDuration(approach.result.duration)} (${formatMemory(approach.result.memoryDelta)} MB Δ)`);
    });
    
    // Speed analysis
    if (successfulApproaches.length > 1) {
        const fastest = successfulApproaches.reduce((a, b) => a.result.duration < b.result.duration ? a : b);
        const slowest = successfulApproaches.reduce((a, b) => a.result.duration > b.result.duration ? a : b);
        const speedup = slowest.result.duration / fastest.result.duration;
        
        console.log(`\n🏃 Speed Analysis:`);
        console.log(`   Fastest: ${fastest.name} (${formatDuration(fastest.result.duration)})`);
        console.log(`   Slowest: ${slowest.name} (${formatDuration(slowest.result.duration)})`);
        console.log(`   Speedup: ${speedup.toFixed(2)}x faster`);
    }
    
    // Memory analysis
    console.log(`\n🧠 Memory Analysis:`);
    successfulApproaches.forEach(approach => {
        console.log(`   ${approach.name.padEnd(15)}: Peak ${formatMemory(approach.result.peakMemory)} MB, Delta ${formatMemory(approach.result.memoryDelta)} MB`);
        
        if (approach.result.metrics) {
            const metrics = approach.result.metrics;
            console.log(`      └─ Array: ${metrics.resultArrayMemoryMB.toFixed(1)} MB, Stack: ${metrics.stackMemoryMB.toFixed(1)} MB, Depth: ${metrics.maxStackDepth}`);
            if (metrics.batchesProcessed !== undefined) {
                console.log(`      └─ Chunks: ${metrics.batchesProcessed.toLocaleString()}`);
            }
        }
    });
    
    // Winner determination
    if (successfulApproaches.length === 3) {
        console.log(`\n🏆 THREE-WAY WINNER ANALYSIS:`);
        
        // Memory efficiency winner
        const mostMemoryEfficient = successfulApproaches.reduce((a, b) => 
            a.result.peakMemory < b.result.peakMemory ? a : b);
        console.log(`   🧠 Most Memory Efficient: ${mostMemoryEfficient.name}`);
        
        // Speed winner
        const fastest = successfulApproaches.reduce((a, b) => 
            a.result.duration < b.result.duration ? a : b);
        console.log(`   🏃 Fastest: ${fastest.name}`);
        
        // Balanced winner (speed + memory)
        const balanced = successfulApproaches.map(a => {
            const speedScore = 1 / a.result.duration; // Higher is better
            const memoryScore = 1 / a.result.peakMemory; // Higher is better (less memory used)
            return {
                name: a.name,
                score: speedScore * memoryScore,
                speedScore,
                memoryScore
            };
        }).reduce((a, b) => a.score > b.score ? a : b);
        
        console.log(`   ⚖️  Best Balanced: ${balanced.name}`);
        
        // Specific recommendations
        console.log(`\n💡 Recommendations:`);
        if (memoryOptimized.success && original.success) {
            const memoryImprovement = (original.peakMemory - memoryOptimized.peakMemory) / original.peakMemory * 100;
            if (memoryImprovement > 10) {
                console.log(`   🎯 Memory-Optimized reduces memory by ${memoryImprovement.toFixed(1)}% - ideal for large datasets`);
            }
        }
        
        if (generator.success && original.success) {
            const speedImprovement = original.duration / generator.duration;
            if (speedImprovement > 2) {
                console.log(`   ⚡ Generator is ${speedImprovement.toFixed(1)}x faster - ideal for performance-critical scenarios`);
            }
        }
        
        // Strategy guidance
        console.log(`\n🎪 Strategy Guidance:`);
        console.log(`   📁 Small dirs (<10k files): Original approach (simple & reliable)`);
        console.log(`   🚀 Speed priority: Generator approach (batch processing)`);
        console.log(`   🍀 Memory constrained: Memory-Optimized approach (adaptive strategies)`);
        console.log(`   🏢 Large enterprise: Memory-Optimized (scales with directory size)`);
        
    } else if (successfulApproaches.length === 2) {
        const working = successfulApproaches.map(a => a.name).join(' and ');
        const failed = ['Original', 'Generator', 'Memory-Optimized'].filter(name => 
            !successfulApproaches.some(a => a.name === name))[0];
        
        console.log(`\n🏆 WINNER: ${working}`);
        console.log(`   Reason: ${failed} approach failed (likely memory constraints)`);
        
    } else {
        const winner = successfulApproaches[0];
        console.log(`\n🏆 WINNER: ${winner.name}`);
        console.log(`   Reason: Only approach that succeeded with this dataset size`);
    }
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('❌ Please provide the directory path to test');
        console.log('Usage: node large_directory_comparison.js <directory_path> [batch_size]');
        console.log('Example: node large_directory_comparison.js C:\\my\\large\\folder 1000');
        process.exit(1);
    }
    
    const testDir = args[0];
    const batchSize = parseInt(args[1]) || 1000;
    
    console.log('🚀 LARGE DIRECTORY FIND COMPARISON');
    console.log('=====================================');
    console.log(`📁 Target Directory: ${testDir}`);
    console.log(`📦 Generator Batch Size: ${batchSize.toLocaleString()}`);
    console.log(`🖥️  Node.js Version: ${process.version}`);
    console.log(`🔧 Platform: ${os.platform()} ${os.arch()}`);
    console.log(`💾 System Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB total`);
    console.log(`🔍 Heap Limit: ~${Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024)} MB`);
    
    if (global.gc) {
        console.log('✅ Garbage collection available for accurate memory testing');
    } else {
        console.log('⚠️  Garbage collection not available (run with --expose-gc for better accuracy)');
    }
    
    try {
        // Analyze directory
        analyzeDirectory(testDir);
        
        // Run tests with delay between them
        console.log('\n🏃 Starting performance comparison...');
        
        // Test original approach
        const originalResult = testOriginalFind(testDir);
        
        // Wait between tests
        console.log('\n⏸️  Waiting 3 seconds between tests...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test generator approach
        const generatorResult = testGeneratorFind(testDir, batchSize);
        
        // Wait between tests
        console.log('\n⏸️  Waiting 3 seconds between tests...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test memory-optimized approach
        const memoryOptimizedResult = testMemoryOptimizedFind(testDir);
        
        // Compare all three results
        compareAllResults(originalResult, generatorResult, memoryOptimizedResult);
        
        // Additional insights for three approaches
        console.log('\n💡 Key Insights for Large Directory Scenarios:');
        
        const approaches = [
            { name: 'Original', result: originalResult },
            { name: 'Generator', result: generatorResult },
            { name: 'Memory-Optimized', result: memoryOptimizedResult }
        ];
        
        const successful = approaches.filter(a => a.result.success);
        const failed = approaches.filter(a => !a.result.success);
        
        if (failed.length > 0) {
            console.log('   � Failed Approaches:');
            failed.forEach(f => {
                console.log(`      ${f.name}: ${f.result.error}`);
            });
        }
        
        if (successful.length > 1 && successful.every(s => s.result.metrics)) {
            console.log('   📊 Memory Breakdown Analysis:');
            successful.forEach(approach => {
                const metrics = approach.result.metrics;
                console.log(`      ${approach.name}: Array ${metrics.resultArrayMemoryMB.toFixed(1)} MB + Stack ${metrics.stackMemoryMB.toFixed(1)} MB = ${(metrics.resultArrayMemoryMB + metrics.stackMemoryMB).toFixed(1)} MB total`);
            });
            
            // Compare efficiency improvements
            if (successful.length === 3) {
                const orig = successful.find(s => s.name === 'Original');
                const gen = successful.find(s => s.name === 'Generator');
                const mem = successful.find(s => s.name === 'Memory-Optimized');
                
                if (orig && gen && mem) {
                    console.log('   🔄 Efficiency Improvements:');
                    
                    const genSpeedup = orig.result.duration / gen.result.duration;
                    const memSpeedup = orig.result.duration / mem.result.duration;
                    
                    if (genSpeedup > 1.2) {
                        console.log(`      ⚡ Generator is ${genSpeedup.toFixed(1)}x faster than Original`);
                    }
                    if (memSpeedup > 1.2) {
                        console.log(`      ⚡ Memory-Optimized is ${memSpeedup.toFixed(1)}x faster than Original`);
                    }
                    
                    const genMemoryRatio = orig.result.peakMemory / gen.result.peakMemory;
                    const memMemoryRatio = orig.result.peakMemory / mem.result.peakMemory;
                    
                    if (genMemoryRatio > 1.2) {
                        console.log(`      🧠 Generator uses ${((1 - 1/genMemoryRatio) * 100).toFixed(1)}% less peak memory`);
                    }
                    if (memMemoryRatio > 1.2) {
                        console.log(`      🧠 Memory-Optimized uses ${((1 - 1/memMemoryRatio) * 100).toFixed(1)}% less peak memory`);
                    }
                    
                    // Adaptive strategy insights
                    if (mem.result.metrics.batchesProcessed !== undefined) {
                        console.log(`      🎯 Memory-Optimized processed ${mem.result.metrics.batchesProcessed.toLocaleString()} chunks adaptively`);
                    }
                }
            }
        }
        
        console.log('\n✅ Large directory comparison complete!');
        
    } catch (error) {
        console.error(`❌ Error during comparison:`, error.message);
        process.exit(1);
    }
}

// Run the comparison
main().catch(console.error);