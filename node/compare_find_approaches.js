/**
 * Comprehensive comparison of Original find() vs Generator-based find()
 * Tests memory performance, execution time, and behavior differences
 */

const tl = require('./_build/task');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Test configuration
const TEST_CONFIG = {
    baseDir: path.join(os.tmpdir(), 'find_comparison_test'),
    scenarios: [
        { name: 'Small (100 files)', files: 100, depth: 3 },
        { name: 'Medium (1,000 files)', files: 1000, depth: 5 },
        { name: 'Large (5,000 files)', files: 5000, depth: 7 },
        { name: 'Deep (500 files, 15 levels)', files: 500, depth: 15 }
    ]
};

/**
 * Create test directory structure
 */
function createTestStructure(baseDir, fileCount, maxDepth) {
    console.log(`📁 Creating test structure: ${fileCount} files, ${maxDepth} levels deep...`);
    
    // Clean and create base directory
    if (fs.existsSync(baseDir)) {
        fs.rmSync(baseDir, { recursive: true, force: true });
    }
    fs.mkdirSync(baseDir, { recursive: true });
    
    let filesCreated = 0;
    const filesPerLevel = Math.ceil(fileCount / maxDepth);
    
    function createLevel(currentDir, level) {
        if (level > maxDepth || filesCreated >= fileCount) return;
        
        const filesInThisLevel = Math.min(filesPerLevel, fileCount - filesCreated);
        
        // Create files in current level
        for (let i = 0; i < filesInThisLevel && filesCreated < fileCount; i++) {
            const fileName = `file_${level}_${i}.txt`;
            const filePath = path.join(currentDir, fileName);
            fs.writeFileSync(filePath, `Content for ${fileName} at level ${level}`);
            filesCreated++;
        }
        
        // Create subdirectories for next level
        if (level < maxDepth && filesCreated < fileCount) {
            const subDirsCount = Math.min(3, Math.ceil((fileCount - filesCreated) / filesPerLevel));
            for (let i = 0; i < subDirsCount; i++) {
                const subDir = path.join(currentDir, `level_${level + 1}_dir_${i}`);
                fs.mkdirSync(subDir, { recursive: true });
                createLevel(subDir, level + 1);
            }
        }
    }
    
    createLevel(baseDir, 1);
    console.log(`✅ Created ${filesCreated} files across ${maxDepth} levels`);
    return filesCreated;
}

/**
 * Format memory in MB
 */
function formatMemory(bytes) {
    return (bytes / 1024 / 1024).toFixed(3);
}

/**
 * Format duration in ms
 */
function formatDuration(ms) {
    return ms.toFixed(2);
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
 * Run performance test for original find()
 */
function testOriginalFind(testDir) {
    console.log('🔍 Testing Original find()...');
    
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
    
    const startMemory = getMemoryUsage();
    const startTime = process.hrtime.bigint();
    
    // Run original find
    const results = tl.find(testDir);
    
    const endTime = process.hrtime.bigint();
    const endMemory = getMemoryUsage();
    
    const duration = Number(endTime - startTime) / 1000000; // Convert to ms
    const memoryDelta = {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
        rss: endMemory.rss - startMemory.rss
    };
    
    return {
        approach: 'Original find()',
        filesFound: results.length,
        duration: duration,
        memoryDelta: memoryDelta,
        startMemory: startMemory,
        endMemory: endMemory,
        results: results.slice(0, 5) // Sample results for verification
    };
}

/**
 * Run performance test for generator-based find with metrics
 */
function testGeneratorFind(testDir, batchSize = 1000) {
    console.log(`🔄 Testing Generator find() with batch size ${batchSize}...`);
    
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
    
    const startMemory = getMemoryUsage();
    const startTime = process.hrtime.bigint();
    
    // Run generator-based find with metrics
    const result = tl.findWithMetrics(testDir, undefined, batchSize, true);
    
    const endTime = process.hrtime.bigint();
    const endMemory = getMemoryUsage();
    
    const duration = Number(endTime - startTime) / 1000000; // Convert to ms
    const memoryDelta = {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
        rss: endMemory.rss - startMemory.rss
    };
    
    return {
        approach: `Generator find() (batch: ${batchSize})`,
        filesFound: result.results.length,
        duration: duration,
        memoryDelta: memoryDelta,
        startMemory: startMemory,
        endMemory: endMemory,
        metrics: result.metrics,
        results: result.results.slice(0, 5) // Sample results for verification
    };
}

/**
 * Compare two test results
 */
function compareResults(original, generator) {
    console.log('\n📊 PERFORMANCE COMPARISON');
    console.log('=' .repeat(80));
    
    // Basic comparison
    console.log(`Files Found:`);
    console.log(`  Original: ${original.filesFound}`);
    console.log(`  Generator: ${generator.filesFound}`);
    console.log(`  Match: ${original.filesFound === generator.filesFound ? '✅' : '❌'}`);
    
    // Duration comparison
    console.log(`\nExecution Time:`);
    console.log(`  Original: ${formatDuration(original.duration)} ms`);
    console.log(`  Generator: ${formatDuration(generator.duration)} ms`);
    const speedRatio = original.duration / generator.duration;
    console.log(`  Speed Ratio: ${speedRatio.toFixed(2)}x ${speedRatio > 1 ? '(Generator faster)' : '(Original faster)'}`);
    
    // Memory comparison
    console.log(`\nMemory Usage (Heap):`);
    console.log(`  Original Delta: ${formatMemory(original.memoryDelta.heapUsed)} MB`);
    console.log(`  Generator Delta: ${formatMemory(generator.memoryDelta.heapUsed)} MB`);
    const memoryRatio = original.memoryDelta.heapUsed / generator.memoryDelta.heapUsed;
    console.log(`  Memory Ratio: ${memoryRatio.toFixed(2)}x ${memoryRatio > 1 ? '(Generator more efficient)' : '(Original more efficient)'}`);
    
    // Peak memory
    console.log(`\nPeak Memory Usage:`);
    console.log(`  Original Peak: ${formatMemory(original.endMemory.heapUsed)} MB`);
    console.log(`  Generator Peak: ${formatMemory(generator.endMemory.heapUsed)} MB`);
    
    // Generator-specific metrics
    if (generator.metrics) {
        console.log(`\nGenerator Detailed Metrics:`);
        console.log(`  Result Array Memory: ${generator.metrics.resultArrayMemoryMB.toFixed(3)} MB`);
        console.log(`  Peak Stack Memory: ${generator.metrics.stackMemoryMB.toFixed(3)} MB`);
        console.log(`  Max Stack Depth: ${generator.metrics.maxStackDepth}`);
        console.log(`  Batches Processed: ${generator.metrics.batchesProcessed}`);
        console.log(`  Memory Snapshots: ${generator.metrics.snapshots.length}`);
        
        // Memory efficiency analysis
        const stackVsArrayRatio = generator.metrics.stackMemoryMB / generator.metrics.resultArrayMemoryMB;
        console.log(`  Stack vs Array Ratio: ${stackVsArrayRatio.toFixed(2)}x`);
        console.log(`  Primary Memory Consumer: ${stackVsArrayRatio > 1 ? 'Traversal Stack' : 'Result Array'}`);
    }
    
    // Results verification
    console.log(`\nResult Verification:`);
    const sampleMatch = JSON.stringify(original.results.sort()) === JSON.stringify(generator.results.sort());
    console.log(`  Sample Results Match: ${sampleMatch ? '✅' : '❌'}`);
    
    return {
        filesMatch: original.filesFound === generator.filesFound,
        speedRatio: speedRatio,
        memoryRatio: memoryRatio,
        sampleMatch: sampleMatch
    };
}

/**
 * Run comprehensive comparison test
 */
async function runComparisonTest(scenario) {
    console.log('\n' + '='.repeat(80));
    console.log(`🧪 TESTING SCENARIO: ${scenario.name}`);
    console.log('='.repeat(80));
    
    const testDir = path.join(TEST_CONFIG.baseDir, scenario.name.replace(/[^a-zA-Z0-9]/g, '_'));
    
    // Create test structure
    const actualFiles = createTestStructure(testDir, scenario.files, scenario.depth);
    
    // Wait a moment for file system
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('\n🏃 Running performance tests...');
    
    // Test original approach
    const originalResult = testOriginalFind(testDir);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test generator approach with different batch sizes
    const generatorResults = [];
    const batchSizes = [100, 1000, 5000];
    
    for (const batchSize of batchSizes) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const generatorResult = testGeneratorFind(testDir, batchSize);
        generatorResults.push(generatorResult);
    }
    
    // Compare results
    console.log('\n📈 DETAILED COMPARISONS');
    console.log('-'.repeat(80));
    
    const comparisons = [];
    for (const generatorResult of generatorResults) {
        console.log(`\n--- vs ${generatorResult.approach} ---`);
        const comparison = compareResults(originalResult, generatorResult);
        comparisons.push({
            ...comparison,
            batchSize: generatorResult.approach.match(/\d+/)[0],
            generator: generatorResult
        });
    }
    
    // Find best performing generator configuration
    const bestGenerator = generatorResults.reduce((best, current) => {
        const bestRatio = best.memoryDelta.heapUsed / originalResult.memoryDelta.heapUsed;
        const currentRatio = current.memoryDelta.heapUsed / originalResult.memoryDelta.heapUsed;
        return currentRatio < bestRatio ? current : best;
    });
    
    console.log('\n🏆 BEST GENERATOR CONFIGURATION');
    console.log('-'.repeat(50));
    console.log(`Best: ${bestGenerator.approach}`);
    console.log(`Memory Efficiency: ${(originalResult.memoryDelta.heapUsed / bestGenerator.memoryDelta.heapUsed).toFixed(2)}x better than original`);
    console.log(`Speed: ${(bestGenerator.duration / originalResult.duration).toFixed(2)}x ${bestGenerator.duration < originalResult.duration ? 'faster' : 'slower'}`);
    
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
    
    return {
        scenario: scenario,
        original: originalResult,
        generators: generatorResults,
        comparisons: comparisons,
        best: bestGenerator
    };
}

/**
 * Main execution
 */
async function main() {
    console.log('🚀 FIND APPROACHES COMPARISON SUITE');
    console.log('====================================');
    console.log(`Node.js Version: ${process.version}`);
    console.log(`Platform: ${os.platform()} ${os.arch()}`);
    console.log(`Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB total`);
    
    // Check if garbage collection is available
    if (global.gc) {
        console.log('✅ Garbage collection available for accurate memory testing');
    } else {
        console.log('⚠️  Garbage collection not available (run with --expose-gc for better accuracy)');
    }
    
    const allResults = [];
    
    // Run all scenarios
    for (const scenario of TEST_CONFIG.scenarios) {
        try {
            const result = await runComparisonTest(scenario);
            allResults.push(result);
        } catch (error) {
            console.error(`❌ Error in scenario ${scenario.name}:`, error.message);
        }
    }
    
    // Summary report
    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY REPORT');
    console.log('='.repeat(80));
    
    for (const result of allResults) {
        console.log(`\n${result.scenario.name}:`);
        console.log(`  Files: ${result.original.filesFound}`);
        console.log(`  Original Time: ${formatDuration(result.original.duration)} ms`);
        console.log(`  Original Memory: ${formatMemory(result.original.memoryDelta.heapUsed)} MB`);
        console.log(`  Best Generator: ${result.best.approach}`);
        console.log(`  Best Time: ${formatDuration(result.best.duration)} ms (${(result.best.duration / result.original.duration).toFixed(2)}x)`);
        console.log(`  Best Memory: ${formatMemory(result.best.memoryDelta.heapUsed)} MB (${(result.original.memoryDelta.heapUsed / result.best.memoryDelta.heapUsed).toFixed(2)}x better)`);
    }
    
    console.log('\n✅ Comparison complete!');
    console.log('\n💡 Key Insights:');
    console.log('   - Compare memory efficiency ratios across scenarios');
    console.log('   - Larger datasets show bigger differences'); 
    console.log('   - Batch size affects memory vs speed tradeoffs');
    console.log('   - Generator approach provides detailed metrics for optimization');
}

// Run the comparison
main().catch(console.error);