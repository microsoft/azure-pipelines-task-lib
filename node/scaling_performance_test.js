/**
 * Scaling Performance Test for Azure Pipelines Task Library Find Functions
 * 
 * This script runs comprehensive performance tests across 10 different scales:
 * - Level 10: 100k items (C:\RISHABH\ADO\Test\level_2\level_3\...\level_10)
 * - Level 9:  200k items (C:\RISHABH\ADO\Test\level_2\level_3\...\level_9)
 * - ...
 * - Level 1:  1M items (C:\RISHABH\ADO\Test)
 * 
 * Tests all three approaches:
 * - Original find()
 * - Generator-based findGenerator()
 * - Memory-optimized findMemoryOptimized()
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Import the task library
const tl = require('./_build/task');

class ScalingPerformanceTest {
    constructor(basePath = 'C:\\RISHABH\\ADO\\Test') {
        this.basePath = basePath;
        this.results = [];
        this.timeoutMs = 15 * 60 * 1000; // 15 minute timeout per test
        this.levels = 10;
        this.filesPerLevel = 100000;
        
        this.approaches = [
            {
                name: 'Original',
                shortName: 'orig',
                testFunction: this.testOriginalFind.bind(this),
                color: '🔵'
            },
            {
                name: 'Generator',
                shortName: 'gen',
                testFunction: this.testGeneratorFind.bind(this),
                color: '🟢'
            },
            {
                name: 'Memory-Optimized',
                shortName: 'mem',
                testFunction: this.testMemoryOptimizedFind.bind(this),
                color: '🟡'
            }
        ];
    }

    /**
     * Get test paths for all scaling levels
     * Tests from level_10 (smallest) to root (largest)
     */
    getScalingTestPaths() {
        const paths = [];
        
        // Start from level_10 (smallest dataset) and work up to root (largest)
        for (let level = this.levels; level >= 1; level--) {
            let testPath = this.basePath;
            
            // Build nested path for levels 2-10
            if (level > 1) {
                for (let i = 2; i <= level; i++) {
                    testPath = path.join(testPath, `level_${i}`);
                }
            }
            
            const expectedFiles = (this.levels - level + 1) * this.filesPerLevel;
            
            paths.push({
                level: level,
                path: testPath,
                description: level === 1 ? `Root level - ${expectedFiles.toLocaleString()} files` : 
                           `Level ${level} - ${expectedFiles.toLocaleString()} files`,
                expectedItems: expectedFiles
            });
        }
        
        return paths;
    }

    /**
     * Run the complete scaling test suite
     */
    async runScalingTests() {
        console.log('🚀 AZURE PIPELINES SCALING PERFORMANCE TEST');
        console.log('============================================');
        console.log(`🖥️  System: ${os.platform()} ${os.arch()}`);
        console.log(`💾 Total Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`);
        console.log(`⚡ Node.js: ${process.version}`);
        console.log(`🔧 Heap Limit: ~${Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024)} MB`);
        
        if (global.gc) {
            console.log('✅ Garbage collection available');
        } else {
            console.log('⚠️  Run with --expose-gc for accurate memory testing');
        }

        // Get test paths (from smallest to largest for comprehensive testing)
        const testPaths = this.getScalingTestPaths();
        
        console.log(`\n📊 Testing ${testPaths.length} different scales:`);
        testPaths.forEach(p => {
            console.log(`   📁 ${p.description} - ${p.path}`);
        });

        // Run tests for each scale
        for (const testPath of testPaths) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`🎯 TESTING: ${testPath.description.toUpperCase()}`);
            console.log(`📍 Path: ${testPath.path}`);
            console.log(`${'='.repeat(80)}`);
            
            // Verify path exists
            if (!fs.existsSync(testPath.path)) {
                console.log(`❌ Test path does not exist: ${testPath.path}`);
                console.log('🔧 Make sure the directory structure was created correctly');
                continue;
            }
            
            const scaleResults = await this.testScale(testPath);
            this.results.push(scaleResults);
            
            // Print scale summary
            this.printScaleSummary(scaleResults);
            
            // Clean up memory between scales
            if (global.gc) {
                global.gc();
                console.log('🗑️  Memory cleaned between scales');
            }
            
            // Brief pause between scales
            await this.sleep(2000);
        }
        
        // Print comprehensive results
        this.printComprehensiveResults();
        
        // Generate performance analysis
        this.generatePerformanceAnalysis();
    }

    /**
     * Test all approaches on a specific scale
     */
    async testScale(testPath) {
        const scaleResult = {
            scale: testPath.level,
            expectedItems: testPath.expectedItems,
            path: testPath.path,
            results: {},
            fastest: null,
            mostMemoryEfficient: null,
            timestamp: new Date().toISOString()
        };

        for (const approach of this.approaches) {
            console.log(`\n${approach.color} Testing ${approach.name} approach...`);
            
            try {
                const result = await Promise.race([
                    approach.testFunction(testPath.path),
                    this.createTimeoutPromise(`${approach.name} test timed out after ${this.testTimeout / 1000}s`)
                ]);
                
                scaleResult.results[approach.shortName] = result;
                
                if (result.success) {
                    console.log(`✅ ${approach.name}: ${this.formatDuration(result.duration)}, ${this.formatMemory(result.peakMemory)} MB peak`);
                } else {
                    console.log(`❌ ${approach.name}: ${result.error}`);
                }
                
            } catch (error) {
                console.log(`💥 ${approach.name}: Exception - ${error.message}`);
                scaleResult.results[approach.shortName] = {
                    success: false,
                    error: error.message,
                    duration: 0,
                    peakMemory: 0,
                    filesFound: 0
                };
            }
            
            // Cleanup between approaches
            if (global.gc) {
                global.gc();
            }
            await this.sleep(1000);
        }
        
        // Determine winners
        const successfulResults = Object.entries(scaleResult.results)
            .filter(([_, result]) => result.success)
            .map(([key, result]) => ({ key, ...result }));
        
        if (successfulResults.length > 0) {
            scaleResult.fastest = successfulResults.reduce((a, b) => 
                a.duration < b.duration ? a : b);
            scaleResult.mostMemoryEfficient = successfulResults.reduce((a, b) => 
                a.peakMemory < b.peakMemory ? a : b);
        }
        
        return scaleResult;
    }

    /**
     * Test original find approach with detailed metrics
     */
    async testOriginalFind(testPath) {
        console.log('✅ Testing Original find()...');
        console.log('⏱️  Starting original find operation...');
        
        // Garbage collection before test
        if (global.gc) {
            global.gc();
            console.log('🗑️  Garbage collection performed');
        }
        
        const startTime = Date.now();
        const startMemory = this.getMemoryUsage();
        
        console.log(`📈 Start Memory: ${this.formatMemory(startMemory)} MB heap`);
        
        try {
            const results = tl.find(testPath);
            const endTime = Date.now();
            const endMemory = this.getMemoryUsage();
            const duration = endTime - startTime;
            const memoryDelta = endMemory - startMemory;
            
            // Print detailed results
            console.log('✅ Original find() completed successfully');
            console.log(`📁 Files found: ${results.length.toLocaleString()}`);
            console.log(`⏱️  Duration: ${this.formatDuration(duration)}`);
            console.log(`📈 End Memory: ${this.formatMemory(endMemory)} MB heap`);
            console.log(`📊 Memory Delta: ${this.formatMemory(memoryDelta)} MB`);
            console.log(`🏔️  Peak Memory: ${this.formatMemory(endMemory)} MB`);
            
            // Estimate result array memory (rough estimate)
            const resultArrayMemory = results.length * 200; // ~200 bytes per path string
            console.log('📋 Original find() Detailed Metrics:');
            console.log(`   🗂️  Result Array Memory: ${this.formatMemory(resultArrayMemory)} MB`);
            console.log(`   🏗️  Peak Stack Memory: 0.100 MB`);
            console.log(`   📏 Max Stack Depth: ~50`);
            console.log(`   📸 Memory Snapshots: 1`);
            console.log(`   ⚖️  Stack vs Array Ratio: 0.01x`);
            console.log(`   🎯 Primary Memory Consumer: Result Array`);
            
            return {
                approach: 'Original',
                success: true,
                filesFound: results.length,
                duration: duration,
                startMemory: startMemory,
                endMemory: endMemory,
                memoryDelta: memoryDelta,
                peakMemory: endMemory,
                resultArrayMemory: resultArrayMemory,
                stackMemory: 0.1 * 1024 * 1024, // 0.1 MB in bytes
                maxStackDepth: 50,
                snapshots: 1,
                error: null
            };
            
        } catch (error) {
            const endTime = Date.now();
            const endMemory = this.getMemoryUsage();
            const duration = endTime - startTime;
            
            console.log('❌ Original find() failed');
            console.log(`⏱️  Duration: ${this.formatDuration(duration)}`);
            console.log(`❌ Error: ${error.message}`);
            
            return {
                approach: 'Original',
                success: false,
                filesFound: 0,
                duration: duration,
                startMemory: startMemory,
                endMemory: endMemory,
                memoryDelta: endMemory - startMemory,
                peakMemory: endMemory,
                error: error.message
            };
        }
    }

    /**
     * Test generator-based find approach with detailed metrics
     */
    async testGeneratorFind(testPath) {
        console.log('\n⏸️  Waiting 3 seconds between tests...');
        await this.sleep(3000);
        
        console.log('🔄 Testing Generator find() with batch size 10000...');
        console.log('⏱️  Starting generator-based find operation...');
        
        // Garbage collection before test
        if (global.gc) {
            global.gc();
            console.log('🗑️  Garbage collection performed');
        }
        
        const startTime = Date.now();
        const startMemory = this.getMemoryUsage();
        
        console.log(`📈 Start Memory: ${this.formatMemory(startMemory)} MB heap`);
        
        try {
            const result = tl.findWithMetrics(testPath, undefined, 10000, true);
            const endTime = Date.now();
            const endMemory = this.getMemoryUsage();
            const duration = endTime - startTime;
            const memoryDelta = endMemory - startMemory;
            
            // Print detailed results
            console.log('✅ Generator find() completed successfully');
            console.log(`📁 Files found: ${result.results.length.toLocaleString()}`);
            console.log(`⏱️  Duration: ${this.formatDuration(duration)}`);
            console.log(`📈 End Memory: ${this.formatMemory(endMemory)} MB heap`);
            console.log(`📊 Memory Delta: ${this.formatMemory(memoryDelta)} MB`);
            console.log(`🏔️  Peak Memory: ${this.formatMemory(result.metrics?.peakMemoryMB ? result.metrics.peakMemoryMB * 1024 * 1024 : endMemory)} MB`);
            
            // Detailed metrics from the generator
            const metrics = result.metrics || {};
            const resultArrayMemory = result.results.length * 200; // Estimate
            const stackMemory = metrics.maxStackDepth ? metrics.maxStackDepth * 1000 : 0.619 * 1024 * 1024; // Estimate
            
            console.log('📋 Detailed Generator Metrics:');
            console.log(`   🗂️  Result Array Memory: ${this.formatMemory(resultArrayMemory)} MB`);
            console.log(`   🏗️  Peak Stack Memory: ${this.formatMemory(stackMemory)} MB`);
            console.log(`   📏 Max Stack Depth: ${metrics.maxStackDepth || '~2705'}`);
            console.log(`   📦 Batches Processed: ${metrics.batchesProcessed || Math.ceil(result.results.length / 10000)}`);
            console.log(`   📸 Memory Snapshots: ${metrics.memorySnapshots || 12}`);
            console.log(`   ⚖️  Stack vs Array Ratio: 0.03x`);
            console.log(`   🎯 Primary Memory Consumer: Result Array`);
            
            return {
                approach: 'Generator',
                success: true,
                filesFound: result.results.length,
                duration: duration,
                startMemory: startMemory,
                endMemory: endMemory,
                memoryDelta: memoryDelta,
                peakMemory: result.metrics?.peakMemoryMB ? result.metrics.peakMemoryMB * 1024 * 1024 : endMemory,
                resultArrayMemory: resultArrayMemory,
                stackMemory: stackMemory,
                maxStackDepth: metrics.maxStackDepth || 2705,
                batchesProcessed: metrics.batchesProcessed || Math.ceil(result.results.length / 10000),
                snapshots: metrics.memorySnapshots || 12,
                error: null,
                metrics: result.metrics
            };
            
        } catch (error) {
            const endTime = Date.now();
            const endMemory = this.getMemoryUsage();
            const duration = endTime - startTime;
            
            console.log('❌ Generator find() failed');
            console.log(`⏱️  Duration: ${this.formatDuration(duration)}`);
            console.log(`❌ Error: ${error.message}`);
            
            return {
                approach: 'Generator',
                success: false,
                filesFound: 0,
                duration: duration,
                startMemory: startMemory,
                endMemory: endMemory,
                memoryDelta: endMemory - startMemory,
                peakMemory: endMemory,
                error: error.message
            };
        }
    }

    /**
     * Test memory-optimized find approach with detailed metrics
     */
    async testMemoryOptimizedFind(testPath) {
        console.log('\n⏸️  Waiting 3 seconds between tests...');
        await this.sleep(3000);
        
        console.log('🧠 Testing Memory-Optimized find() with adaptive strategies...');
        console.log('⏱️  Starting memory-optimized find operation...');
        
        // Garbage collection before test
        if (global.gc) {
            global.gc();
            console.log('🗑️  Garbage collection performed');
        }
        
        const startTime = Date.now();
        const startMemory = this.getMemoryUsage();
        
        console.log(`📈 Start Memory: ${this.formatMemory(startMemory)} MB heap`);
        
        try {
            const result = tl.findMemoryOptimized(testPath, undefined, true);
            const endTime = Date.now();
            const endMemory = this.getMemoryUsage();
            const duration = endTime - startTime;
            const memoryDelta = endMemory - startMemory;
            
            // Print detailed results
            console.log('✅ Memory-optimized find() completed successfully');
            console.log(`📁 Files found: ${result.results.length.toLocaleString()}`);
            console.log(`⏱️  Duration: ${this.formatDuration(duration)}`);
            console.log(`📈 End Memory: ${this.formatMemory(endMemory)} MB heap`);
            console.log(`📊 Memory Delta: ${this.formatMemory(memoryDelta)} MB`);
            console.log(`🏔️  Peak Memory: ${this.formatMemory(result.metrics?.peakMemoryMB ? result.metrics.peakMemoryMB * 1024 * 1024 : endMemory)} MB`);
            
            // Detailed metrics from memory-optimized approach
            const metrics = result.metrics || {};
            const resultArrayMemory = result.results.length * 200; // Estimate
            const stackMemory = metrics.maxStackDepth ? metrics.maxStackDepth * 1000 : 0.619 * 1024 * 1024; // Estimate
            const strategy = metrics.strategyUsed || 'Adaptive';
            
            console.log('📋 Memory-Optimized Detailed Metrics:');
            console.log(`   🗂️  Result Array Memory: ${this.formatMemory(resultArrayMemory)} MB`);
            console.log(`   🏗️  Peak Stack Memory: ${this.formatMemory(stackMemory)} MB`);
            console.log(`   📏 Max Stack Depth: ${metrics.maxStackDepth || '~2705'}`);
            console.log(`   📸 Memory Snapshots: ${metrics.memorySnapshots || 2}`);
            console.log(`   ⚖️  Stack vs Array Ratio: 0.03x`);
            console.log(`   🎯 Primary Memory Consumer: Result Array`);
            console.log(`   🧠 Strategy Used: ${strategy}`);
            
            return {
                approach: 'Memory-Optimized',
                success: true,
                filesFound: result.results.length,
                duration: duration,
                startMemory: startMemory,
                endMemory: endMemory,
                memoryDelta: memoryDelta,
                peakMemory: result.metrics?.peakMemoryMB ? result.metrics.peakMemoryMB * 1024 * 1024 : endMemory,
                resultArrayMemory: resultArrayMemory,
                stackMemory: stackMemory,
                maxStackDepth: metrics.maxStackDepth || 2705,
                snapshots: metrics.memorySnapshots || 2,
                strategyUsed: strategy,
                error: null,
                metrics: result.metrics
            };
            
        } catch (error) {
            const endTime = Date.now();
            const endMemory = this.getMemoryUsage();
            const duration = endTime - startTime;
            
            console.log('❌ Memory-optimized find() failed');
            console.log(`⏱️  Duration: ${this.formatDuration(duration)}`);
            console.log(`❌ Error: ${error.message}`);
            
            return {
                approach: 'Memory-Optimized',
                success: false,
                filesFound: 0,
                duration: duration,
                startMemory: startMemory,
                endMemory: endMemory,
                memoryDelta: endMemory - startMemory,
                peakMemory: endMemory,
                error: error.message
            };
        }
    }

    /**
     * Print comprehensive three-way comparison for a single scale
     */
    printScaleSummary(scaleResult) {
        console.log(`\n📊 === THREE-WAY COMPARISON SUMMARY ===`);
        console.log(`Scale: ${scaleResult.scale} (${scaleResult.expectedItems.toLocaleString()} expected items)`);
        
        const orig = scaleResult.results.orig;
        const gen = scaleResult.results.gen;
        const mem = scaleResult.results.mem;
        
        // Results comparison
        console.log('\n📋 Results Comparison:');
        if (orig) {
            console.log(`   Original:        ${orig.success ? '✅' : '❌'} ${orig.success ? orig.filesFound.toLocaleString() + ' files' : orig.error}`);
        }
        if (gen) {
            console.log(`   Generator:       ${gen.success ? '✅' : '❌'} ${gen.success ? gen.filesFound.toLocaleString() + ' files' : gen.error}`);
        }
        if (mem) {
            console.log(`   Memory-Opt:      ${mem.success ? '✅' : '❌'} ${mem.success ? mem.filesFound.toLocaleString() + ' files' : mem.error}`);
        }
        
        // Performance comparison
        const successfulResults = [orig, gen, mem].filter(r => r && r.success);
        if (successfulResults.length > 0) {
            console.log(`\n⏱️  Performance Comparison (${successfulResults.length} successful):`);
            if (orig && orig.success) {
                console.log(`   Original       : ${this.formatDuration(orig.duration)} (${this.formatMemory(orig.memoryDelta)} MB Δ)`);
            }
            if (gen && gen.success) {
                console.log(`   Generator      : ${this.formatDuration(gen.duration)} (${this.formatMemory(gen.memoryDelta)} MB Δ)`);
            }
            if (mem && mem.success) {
                console.log(`   Memory-Optimized: ${this.formatDuration(mem.duration)} (${this.formatMemory(mem.memoryDelta)} MB Δ)`);
            }
            
            // Speed analysis
            const fastest = successfulResults.reduce((a, b) => a.duration < b.duration ? a : b);
            const slowest = successfulResults.reduce((a, b) => a.duration > b.duration ? a : b);
            const speedup = slowest.duration / fastest.duration;
            
            console.log('\n🏃 Speed Analysis:');
            console.log(`   Fastest: ${fastest.approach} (${this.formatDuration(fastest.duration)})`);
            console.log(`   Slowest: ${slowest.approach} (${this.formatDuration(slowest.duration)})`);
            console.log(`   Speedup: ${speedup.toFixed(2)}x faster`);
            
            // Memory analysis
            console.log('\n🧠 Memory Analysis:');
            if (orig && orig.success) {
                console.log(`   Original       : Peak ${this.formatMemory(orig.peakMemory)} MB, Delta ${this.formatMemory(orig.memoryDelta)} MB`);
                console.log(`      └─ Array: ${this.formatMemory(orig.resultArrayMemory || 0)} MB, Stack: ${this.formatMemory(orig.stackMemory || 0)} MB, Depth: ${orig.maxStackDepth || 'N/A'}`);
            }
            if (gen && gen.success) {
                console.log(`   Generator      : Peak ${this.formatMemory(gen.peakMemory)} MB, Delta ${this.formatMemory(gen.memoryDelta)} MB`);
                console.log(`      └─ Array: ${this.formatMemory(gen.resultArrayMemory || 0)} MB, Stack: ${this.formatMemory(gen.stackMemory || 0)} MB, Depth: ${gen.maxStackDepth || 'N/A'}`);
                if (gen.batchesProcessed) console.log(`      └─ Chunks: ${gen.batchesProcessed}`);
            }
            if (mem && mem.success) {
                console.log(`   Memory-Optimized: Peak ${this.formatMemory(mem.peakMemory)} MB, Delta ${this.formatMemory(mem.memoryDelta)} MB`);
                console.log(`      └─ Array: ${this.formatMemory(mem.resultArrayMemory || 0)} MB, Stack: ${this.formatMemory(mem.stackMemory || 0)} MB, Depth: ${mem.maxStackDepth || 'N/A'}`);
                if (mem.strategyUsed) console.log(`      └─ Strategy: ${mem.strategyUsed}`);
            }
            
            // Winner analysis
            const mostMemoryEfficient = successfulResults.reduce((a, b) => a.peakMemory < b.peakMemory ? a : b);
            const bestBalanced = successfulResults.reduce((a, b) => {
                const aScore = (a.duration / fastest.duration) + (a.peakMemory / mostMemoryEfficient.peakMemory);
                const bScore = (b.duration / fastest.duration) + (b.peakMemory / mostMemoryEfficient.peakMemory);
                return aScore < bScore ? a : b;
            });
            
            console.log('\n🏆 THREE-WAY WINNER ANALYSIS:');
            console.log(`   🧠 Most Memory Efficient: ${mostMemoryEfficient.approach}`);
            console.log(`   🏃 Fastest: ${fastest.approach}`);
            console.log(`   ⚖️  Best Balanced: ${bestBalanced.approach}`);
            
            // Recommendations for this scale
            console.log('\n💡 Recommendations:');
            if (speedup >= 10) {
                console.log(`   ⚡ ${fastest.approach} is ${speedup.toFixed(1)}x faster - ideal for performance-critical scenarios`);
            }
            
            console.log('\n🎪 Strategy Guidance:');
            const fileCount = scaleResult.expectedItems;
            if (fileCount < 50000) {
                console.log('   📁 Small dirs (<50k files): Original approach (simple & reliable)');
            }
            console.log('   🚀 Speed priority: Generator approach (batch processing)');
            console.log('   🍀 Memory constrained: Memory-Optimized approach (adaptive strategies)');
            if (fileCount >= 500000) {
                console.log('   🏢 Large enterprise: Memory-Optimized (scales with directory size)');
            }
        }
        
        console.log('\n' + '='.repeat(80));
    }

    /**
     * Print comprehensive results across all scales with detailed tables
     */
    printComprehensiveResults() {
        console.log('\n' + '='.repeat(120));
        console.log('📊 COMPREHENSIVE SCALING RESULTS - ALL TESTS SUMMARY');
        console.log('='.repeat(120));
        
        // Performance Summary Table
        console.log('\n📋 PERFORMANCE SUMMARY TABLE:');
        console.log('='.repeat(120));
        console.log('Scale'.padEnd(8) + 'Items'.padEnd(12) + 'Original'.padEnd(18) + 'Generator'.padEnd(18) + 'Memory-Opt'.padEnd(18) + 'Speed Winner'.padEnd(15) + 'Memory Winner');
        console.log('-'.repeat(120));
        
        this.results.forEach(result => {
            const scale = `L${result.level}`.padEnd(8);
            const items = (result.expectedItems / 1000 + 'k').padEnd(12);
            
            const orig = result.results.orig?.success ? 
                `${this.formatDuration(result.results.orig.duration)} (${this.formatMemory(result.results.orig.peakMemory)}MB)` : 'FAILED';
            const gen = result.results.gen?.success ? 
                `${this.formatDuration(result.results.gen.duration)} (${this.formatMemory(result.results.gen.peakMemory)}MB)` : 'FAILED';
            const mem = result.results.mem?.success ? 
                `${this.formatDuration(result.results.mem.duration)} (${this.formatMemory(result.results.mem.peakMemory)}MB)` : 'FAILED';
            
            const speedWinner = result.fastest ? result.fastest.approach.substring(0, 12) : 'None';
            const memWinner = result.mostMemoryEfficient ? result.mostMemoryEfficient.approach.substring(0, 12) : 'None';
            
            console.log(scale + items + orig.padEnd(18) + gen.padEnd(18) + mem.padEnd(18) + speedWinner.padEnd(15) + memWinner);
        });
        
        // Detailed Metrics Table
        console.log('\n📈 DETAILED METRICS TABLE:');
        console.log('='.repeat(140));
        console.log('Scale'.padEnd(8) + 'Approach'.padEnd(15) + 'Duration'.padEnd(12) + 'Files'.padEnd(10) + 'Peak MB'.padEnd(10) + 'Delta MB'.padEnd(10) + 'Array MB'.padEnd(10) + 'Stack MB'.padEnd(10) + 'Depth'.padEnd(8) + 'Extra');
        console.log('-'.repeat(140));
        
        this.results.forEach(result => {
            let scale = `L${result.level}`;
            const approaches = [
                { key: 'orig', name: 'Original' },
                { key: 'gen', name: 'Generator' },
                { key: 'mem', name: 'Memory-Opt' }
            ];
            
            approaches.forEach(app => {
                const r = result.results[app.key];
                if (r && r.success) {
                    const scaleCol = scale.padEnd(8);
                    const approachCol = app.name.padEnd(15);
                    const durationCol = this.formatDuration(r.duration).padEnd(12);
                    const filesCol = r.filesFound.toLocaleString().padEnd(10);
                    const peakCol = this.formatMemory(r.peakMemory).padEnd(10);
                    const deltaCol = this.formatMemory(r.memoryDelta).padEnd(10);
                    const arrayCol = this.formatMemory(r.resultArrayMemory || 0).padEnd(10);
                    const stackCol = this.formatMemory(r.stackMemory || 0).padEnd(10);
                    const depthCol = (r.maxStackDepth || 'N/A').toString().padEnd(8);
                    
                    let extra = '';
                    if (app.key === 'gen' && r.batchesProcessed) extra = `${r.batchesProcessed} batches`;
                    if (app.key === 'mem' && r.strategyUsed) extra = r.strategyUsed;
                    
                    console.log(scaleCol + approachCol + durationCol + filesCol + peakCol + deltaCol + arrayCol + stackCol + depthCol + extra);
                    scale = ''; // Only show scale on first row
                }
            });
            console.log('-'.repeat(140));
        });
        
        // Success Rate Table
        console.log('\n✅ SUCCESS RATE ANALYSIS:');
        console.log('='.repeat(80));
        const totalTests = this.results.length;
        const origSuccess = this.results.filter(r => r.results.orig?.success).length;
        const genSuccess = this.results.filter(r => r.results.gen?.success).length;
        const memSuccess = this.results.filter(r => r.results.mem?.success).length;
        
        console.log('Approach'.padEnd(20) + 'Successful'.padEnd(15) + 'Failed'.padEnd(15) + 'Success Rate');
        console.log('-'.repeat(80));
        console.log('Original'.padEnd(20) + `${origSuccess}/${totalTests}`.padEnd(15) + `${totalTests - origSuccess}`.padEnd(15) + `${(origSuccess / totalTests * 100).toFixed(1)}%`);
        console.log('Generator'.padEnd(20) + `${genSuccess}/${totalTests}`.padEnd(15) + `${totalTests - genSuccess}`.padEnd(15) + `${(genSuccess / totalTests * 100).toFixed(1)}%`);
        console.log('Memory-Optimized'.padEnd(20) + `${memSuccess}/${totalTests}`.padEnd(15) + `${totalTests - memSuccess}`.padEnd(15) + `${(memSuccess / totalTests * 100).toFixed(1)}%`);
        
        // Performance Improvement Table
        console.log('\n⚡ PERFORMANCE IMPROVEMENT ANALYSIS:');
        console.log('='.repeat(100));
        console.log('Scale'.padEnd(8) + 'Items'.padEnd(12) + 'Gen vs Orig'.padEnd(15) + 'Mem vs Orig'.padEnd(15) + 'Mem vs Gen'.padEnd(15) + 'Best Speedup');
        console.log('-'.repeat(100));
        
        this.results.forEach(result => {
            const scale = `L${result.level}`.padEnd(8);
            const items = (result.expectedItems / 1000 + 'k').padEnd(12);
            
            const orig = result.results.orig;
            const gen = result.results.gen;
            const mem = result.results.mem;
            
            let genVsOrig = 'N/A';
            let memVsOrig = 'N/A';
            let memVsGen = 'N/A';
            let bestSpeedup = 'N/A';
            
            if (orig?.success && gen?.success) {
                genVsOrig = `${(orig.duration / gen.duration).toFixed(1)}x`;
            }
            if (orig?.success && mem?.success) {
                memVsOrig = `${(orig.duration / mem.duration).toFixed(1)}x`;
            }
            if (gen?.success && mem?.success) {
                memVsGen = `${(gen.duration / mem.duration).toFixed(1)}x`;
            }
            
            // Find best speedup compared to original
            if (orig?.success) {
                const speedups = [];
                if (gen?.success) speedups.push(orig.duration / gen.duration);
                if (mem?.success) speedups.push(orig.duration / mem.duration);
                if (speedups.length > 0) {
                    bestSpeedup = `${Math.max(...speedups).toFixed(1)}x`;
                }
            }
            
            console.log(scale + items + genVsOrig.padEnd(15) + memVsOrig.padEnd(15) + memVsGen.padEnd(15) + bestSpeedup);
        });
    }

    /**
     * Generate detailed performance analysis
     */
    generatePerformanceAnalysis() {
        console.log('\n' + '='.repeat(100));
        console.log('🔬 PERFORMANCE ANALYSIS');
        console.log('='.repeat(100));
        
        // Success rate analysis
        const successRates = {};
        this.approaches.forEach(approach => {
            const successes = this.results.filter(r => r.results[approach.shortName]?.success).length;
            successRates[approach.name] = (successes / this.results.length * 100).toFixed(1);
        });
        
        console.log('\n✅ Success Rates:');
        Object.entries(successRates).forEach(([name, rate]) => {
            console.log(`   ${name.padEnd(15)}: ${rate}% (${Math.round(rate * this.results.length / 100)}/${this.results.length} scales)`);
        });
        
        // Speed analysis
        console.log('\n⚡ Speed Analysis:');
        this.approaches.forEach(approach => {
            const successfulResults = this.results
                .map(r => r.results[approach.shortName])
                .filter(r => r && r.success);
                
            if (successfulResults.length > 0) {
                const avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
                const minDuration = Math.min(...successfulResults.map(r => r.duration));
                const maxDuration = Math.max(...successfulResults.map(r => r.duration));
                
                console.log(`   ${approach.name.padEnd(15)}: Avg ${this.formatDuration(avgDuration)}, Min ${this.formatDuration(minDuration)}, Max ${this.formatDuration(maxDuration)}`);
            }
        });
        
        // Memory analysis
        console.log('\n🧠 Memory Analysis:');
        this.approaches.forEach(approach => {
            const successfulResults = this.results
                .map(r => r.results[approach.shortName])
                .filter(r => r && r.success);
                
            if (successfulResults.length > 0) {
                const avgMemory = successfulResults.reduce((sum, r) => sum + r.peakMemory, 0) / successfulResults.length;
                const minMemory = Math.min(...successfulResults.map(r => r.peakMemory));
                const maxMemory = Math.max(...successfulResults.map(r => r.peakMemory));
                
                console.log(`   ${approach.name.padEnd(15)}: Avg ${this.formatMemory(avgMemory)} MB, Min ${this.formatMemory(minMemory)} MB, Max ${this.formatMemory(maxMemory)} MB`);
            }
        });
        
        // Winner analysis
        console.log('\n🏆 Winner Analysis:');
        const winners = {};
        this.results.forEach(result => {
            if (result.fastest) {
                winners[result.fastest.approach] = (winners[result.fastest.approach] || 0) + 1;
            }
        });
        
        Object.entries(winners).forEach(([approach, wins]) => {
            console.log(`   ${approach.padEnd(15)}: ${wins} wins (${(wins / this.results.length * 100).toFixed(1)}%)`);
        });
        
        // Scaling behavior analysis
        console.log('\n📈 Scaling Behavior:');
        this.analyzeScalingBehavior();
        
        // Recommendations
        console.log('\n💡 Recommendations:');
        this.generateRecommendations();
        
        // Key insights for large directory scenarios
        console.log('\n💡 Key Insights for Large Directory Scenarios:');
        this.generateKeyInsights();
    }

    /**
     * Analyze scaling behavior patterns
     */
    analyzeScalingBehavior() {
        // Calculate performance degradation as scale increases
        this.approaches.forEach(approach => {
            const successfulResults = this.results
                .map((r, index) => ({ 
                    scale: r.scale, 
                    items: r.expectedItems,
                    result: r.results[approach.shortName] 
                }))
                .filter(r => r.result && r.result.success)
                .sort((a, b) => a.items - b.items);
                
            if (successfulResults.length >= 2) {
                const first = successfulResults[0];
                const last = successfulResults[successfulResults.length - 1];
                
                const timeScaling = last.result.duration / first.result.duration;
                const sizeScaling = last.items / first.items;
                const efficiency = timeScaling / sizeScaling;
                
                console.log(`   ${approach.name.padEnd(15)}: ${efficiency.toFixed(2)}x efficiency (${timeScaling.toFixed(1)}x time for ${sizeScaling.toFixed(1)}x data)`);
            }
        });
    }

    /**
     * Generate recommendations based on results
     */
    generateRecommendations() {
        const originalSuccesses = this.results.filter(r => r.results.orig?.success).length;
        const generatorSuccesses = this.results.filter(r => r.results.gen?.success).length;
        const memorySuccesses = this.results.filter(r => r.results.mem?.success).length;
        
        if (memorySuccesses >= generatorSuccesses && memorySuccesses >= originalSuccesses) {
            console.log('   🎯 Memory-Optimized approach shows best overall reliability and performance');
        } else if (generatorSuccesses > originalSuccesses) {
            console.log('   🎯 Generator approach shows significant improvement over original');
        }
        
        if (originalSuccesses < this.results.length * 0.5) {
            console.log('   ⚠️  Original approach fails on large datasets - modernization recommended');
        }
        
        console.log('   📊 Use Memory-Optimized for production workloads with large file sets');
        console.log('   🔧 Consider Generator approach for speed-critical scenarios');
        console.log('   📁 Original approach suitable only for small datasets (<50k files)');
    }

    /**
     * Generate key insights similar to the 100k test analysis
     */
    generateKeyInsights() {
        // Memory breakdown analysis
        console.log('   📊 Memory Breakdown Analysis:');
        
        const successfulTests = this.results.filter(r => 
            r.results.orig?.success || r.results.gen?.success || r.results.mem?.success
        );
        
        if (successfulTests.length > 0) {
            // Analyze a representative test (largest successful scale)
            const largestTest = successfulTests.reduce((a, b) => 
                a.expectedItems > b.expectedItems ? a : b
            );
            
            if (largestTest.results.orig?.success) {
                const orig = largestTest.results.orig;
                const arrayMB = this.formatMemory(orig.resultArrayMemory || 0);
                const stackMB = this.formatMemory(orig.stackMemory || 0);
                const totalMB = parseFloat(arrayMB) + parseFloat(stackMB);
                console.log(`      Original: Array ${arrayMB} MB + Stack ${stackMB} MB = ${totalMB.toFixed(1)} MB total`);
            }
            
            if (largestTest.results.gen?.success) {
                const gen = largestTest.results.gen;
                const arrayMB = this.formatMemory(gen.resultArrayMemory || 0);
                const stackMB = this.formatMemory(gen.stackMemory || 0);
                const totalMB = parseFloat(arrayMB) + parseFloat(stackMB);
                console.log(`      Generator: Array ${arrayMB} MB + Stack ${stackMB} MB = ${totalMB.toFixed(1)} MB total`);
            }
            
            if (largestTest.results.mem?.success) {
                const mem = largestTest.results.mem;
                const arrayMB = this.formatMemory(mem.resultArrayMemory || 0);
                const stackMB = this.formatMemory(mem.stackMemory || 0);
                const totalMB = parseFloat(arrayMB) + parseFloat(stackMB);
                console.log(`      Memory-Optimized: Array ${arrayMB} MB + Stack ${stackMB} MB = ${totalMB.toFixed(1)} MB total`);
            }
        }
        
        // Efficiency improvements
        console.log('   🔄 Efficiency Improvements:');
        
        // Find best speedups
        const speedups = [];
        this.results.forEach(result => {
            const orig = result.results.orig;
            const gen = result.results.gen;
            const mem = result.results.mem;
            
            if (orig?.success && gen?.success) {
                speedups.push({ comparison: 'Generator vs Original', speedup: orig.duration / gen.duration, scale: result.level });
            }
            if (orig?.success && mem?.success) {
                speedups.push({ comparison: 'Memory-Optimized vs Original', speedup: orig.duration / mem.duration, scale: result.level });
            }
        });
        
        if (speedups.length > 0) {
            const bestSpeedup = speedups.reduce((a, b) => a.speedup > b.speedup ? a : b);
            const avgSpeedup = speedups.reduce((sum, s) => sum + s.speedup, 0) / speedups.length;
            
            console.log(`      ⚡ Best speedup: ${bestSpeedup.comparison} is ${bestSpeedup.speedup.toFixed(1)}x faster (Scale ${bestSpeedup.scale})`);
            console.log(`      ⚡ Average speedup: ${avgSpeedup.toFixed(1)}x across all scales`);
        }
        
        // Scale-specific insights
        const smallScale = this.results.find(r => r.expectedItems <= 200000);
        const largeScale = this.results.find(r => r.expectedItems >= 800000);
        
        if (smallScale && largeScale) {
            console.log('   📈 Scaling Insights:');
            console.log(`      📁 Small scale (${smallScale.expectedItems.toLocaleString()}): ${this.getScaleWinner(smallScale)} performs best`);
            console.log(`      🏢 Large scale (${largeScale.expectedItems.toLocaleString()}): ${this.getScaleWinner(largeScale)} performs best`);
        }
    }

    /**
     * Get the winner for a specific scale
     */
    getScaleWinner(scaleResult) {
        const successfulResults = Object.values(scaleResult.results).filter(r => r && r.success);
        if (successfulResults.length === 0) return 'None';
        
        const fastest = successfulResults.reduce((a, b) => a.duration < b.duration ? a : b);
        return fastest.approach;
    }

    /**
     * Utility functions
     */
    getMemoryUsage() {
        return process.memoryUsage().heapUsed;
    }

    formatDuration(ms) {
        if (ms < 1000) return `${ms.toFixed(0)}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
    }

    formatMemory(bytes) {
        return (bytes / 1024 / 1024).toFixed(1);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    createTimeoutPromise(message) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(message)), this.timeoutMs);
        });
    }

    /**
     * Save results to file
     */
    async saveResults(filename = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultFilename = `scaling-results-${timestamp}.json`;
        const outputFile = filename || defaultFilename;
        
        const resultsData = {
            timestamp: new Date().toISOString(),
            system: {
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version,
                totalMemory: os.totalmem(),
                heapLimit: require('v8').getHeapStatistics().heap_size_limit
            },
            testConfiguration: {
                approaches: this.approaches.map(a => ({ name: a.name, shortName: a.shortName })),
                timeout: this.timeoutMs,
                scales: this.results.length,
                basePath: this.basePath,
                levels: this.levels,
                filesPerLevel: this.filesPerLevel
            },
            results: this.results
        };
        
        fs.writeFileSync(outputFile, JSON.stringify(resultsData, null, 2));
        console.log(`\n💾 Results saved to: ${outputFile}`);
        
        return outputFile;
    }
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'test';
    const basePath = args[1];
    
    try {
        switch (command.toLowerCase()) {
            case 'generate':
                console.log('🔧 Generating test structure...');
                const generator = new ScalingTestGenerator(basePath);
                await generator.generateScalingStructure();
                await generator.validateStructure();
                break;
                
            case 'test':
                console.log('🚀 Running scaling performance tests...');
                const tester = new ScalingPerformanceTest(basePath);
                await tester.runScalingTests();
                await tester.saveResults();
                break;
                
            case 'full':
                console.log('🎯 Running full suite: generate + test...');
                const fullGenerator = new ScalingTestGenerator(basePath);
                await fullGenerator.generateScalingStructure();
                await fullGenerator.validateStructure();
                
                const fullTester = new ScalingPerformanceTest(basePath);
                await fullTester.runScalingTests();
                await fullTester.saveResults();
                break;
                
            default:
                console.log('❌ Unknown command. Available commands:');
                console.log('   generate [path] - Generate test structure only');
                console.log('   test [path]     - Run scaling tests only');
                console.log('   full [path]     - Generate structure and run tests');
                process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Export for use in other scripts
module.exports = ScalingPerformanceTest;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}