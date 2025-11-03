/**
 * Enhanced Scaling Performance Test with Process Memory and Fast-Glob
 * 
 * Tests four approaches:
 * 1. Original find()
 * 2. Generator-based findWithMetrics()
 * 3. Memory-optimized findMemoryOptimized()
 * 4. Fast-Glob (native implementation)
 * 
 * Tracks both heap memory and process memory (RSS) for comprehensive analysis
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const fg = require('fast-glob');

// Import existing task library and enhanced memory utils
const tl = require('./_build/task');
const emem = require('./enhanced-memory-utils');

class EnhancedScalingPerformanceTest {
    constructor(basePath = 'C:\\RISHABH\\ADO\\Test', maxLevel = 10) {
        this.basePath = basePath;
        this.results = [];
        this.timeoutMs = 15 * 60 * 1000; // 15 minute timeout per test
        this.levels = 10; // Total levels available
        this.maxLevel = maxLevel; // Maximum level to test (1-10)
        this.filesPerLevel = 100000;
        
        this.approaches = [
            // {
            //     name: 'Original',
            //     shortName: 'orig',
            //     testFunction: this.testOriginalFind.bind(this),
            //     color: '🔵'
            // },
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
            },
            {
                name: 'Fast-Glob',
                shortName: 'fg',
                testFunction: this.testFastGlob.bind(this),
                color: '🚀'
            }
        ];
    }

    /**
     * Get test paths for scaling levels up to maxLevel
     * Level 1 = 100k files, Level 2 = 200k files, etc.
     */
    getScalingTestPaths() {
        const paths = [];
        
        // Test from level maxLevel down to level 1 (largest to smallest)
        // But only test levels 1 through maxLevel
        for (let level = Math.min(this.maxLevel, this.levels); level >= 1; level--) {
            let testPath = this.basePath;
            
            // Build nested path for levels 2-10
            if (level > 1) {
                for (let i = 2; i <= level; i++) {
                    testPath = path.join(testPath, `level_${i}`);
                }
            }
            
            // Each level represents level * 100k files
            const expectedFiles = level * this.filesPerLevel;
            
            paths.push({
                level: level,
                path: testPath,
                description: level === 1 ? `Level ${level} (Root) - ${expectedFiles.toLocaleString()} files` : 
                           `Level ${level} - ${expectedFiles.toLocaleString()} files`,
                expectedItems: expectedFiles
            });
        }
        
        return paths;
    }

    /**
     * Run comprehensive scaling tests with enhanced memory tracking
     */
    async runEnhancedScalingTests() {
        console.log('🚀 ENHANCED AZURE PIPELINES SCALING PERFORMANCE TEST');
        console.log('====================================================');
        
        const systemInfo = emem.getSystemMemoryInfo();
        console.log(`🖥️  System: ${os.platform()} ${os.arch()}`);
        console.log(`💾 Total Memory: ${systemInfo.totalGB} GB (${systemInfo.usagePercent}% used)`);
        console.log(`⚡ Node.js: ${process.version}`);
        console.log(`🔧 Heap Limit: ~${Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024)} MB`);
        console.log(`🎯 Testing up to Level ${this.maxLevel} (${this.maxLevel * 100}k files max)`);
        
        if (global.gc) {
            console.log('✅ Garbage collection available');
        } else {
            console.log('⚠️  Run with --expose-gc for accurate memory testing');
        }

        const testPaths = this.getScalingTestPaths();
        
        console.log(`\n📊 Testing ${testPaths.length} different scales with ${this.approaches.length} approaches:`);
        testPaths.forEach(p => {
            console.log(`   📁 ${p.description} - ${p.path}`);
        });

        // Run tests for each scale
        for (const testPath of testPaths) {
            console.log(`\n${'='.repeat(100)}`);
            console.log(`🎯 TESTING: ${testPath.description.toUpperCase()}`);
            console.log(`📍 Path: ${testPath.path}`);
            console.log(`${'='.repeat(100)}`);
            
            if (!fs.existsSync(testPath.path)) {
                console.log(`❌ Test path does not exist: ${testPath.path}`);
                continue;
            }
            
            const scaleResults = await this.testScale(testPath);
            this.results.push(scaleResults);
            
            // Print enhanced scale summary
            this.printEnhancedScaleSummary(scaleResults);
            
            // System cleanup
            if (global.gc) {
                global.gc();
                console.log('🗑️  Memory cleaned between scales');
            }
            
            await this.sleep(2000);
        }
        
        // Print comprehensive results
        this.printEnhancedComprehensiveResults();
        
        // Generate analysis
        this.generateEnhancedAnalysis();
    }

    /**
     * Test all approaches on a specific scale with enhanced monitoring
     */
    async testScale(testPath) {
        const scaleResult = {
            scale: testPath.level,
            expectedItems: testPath.expectedItems,
            path: testPath.path,
            results: {},
            fastest: null,
            mostMemoryEfficient: null,
            mostRSSEfficient: null,
            timestamp: new Date().toISOString(),
            systemMemoryBefore: emem.getSystemMemoryInfo()
        };

        for (const approach of this.approaches) {
            console.log(`\n${approach.color} Testing ${approach.name} approach...`);
            
            try {
                const result = await Promise.race([
                    approach.testFunction(testPath.path),
                    this.createTimeoutPromise(`${approach.name} test timed out after ${this.timeoutMs / 1000}s`)
                ]);
                
                scaleResult.results[approach.shortName] = result;
                
                if (result.success) {
                    console.log(`✅ ${approach.name}: ${this.formatDuration(result.duration)}, Heap: ${emem.formatMemory(result.peakMemory)}MB, RSS: ${result.peakRSS_MB}MB`);
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
                    peakRSS_MB: 0,
                    filesFound: 0
                };
            }
            
            if (global.gc) global.gc();
            await this.sleep(1000);
        }
        
        // Determine winners with enhanced metrics
        const successfulResults = Object.entries(scaleResult.results)
            .filter(([_, result]) => result.success)
            .map(([key, result]) => ({ key, ...result }));
        
        if (successfulResults.length > 0) {
            scaleResult.fastest = successfulResults.reduce((a, b) => a.duration < b.duration ? a : b);
            scaleResult.mostMemoryEfficient = successfulResults.reduce((a, b) => a.peakMemory < b.peakMemory ? a : b);
            scaleResult.mostRSSEfficient = successfulResults.reduce((a, b) => (a.peakRSS_MB || 0) < (b.peakRSS_MB || 0) ? a : b);
        }
        
        scaleResult.systemMemoryAfter = emem.getSystemMemoryInfo();
        return scaleResult;
    }

    /**
     * Test Original find with enhanced memory tracking
     */
    async testOriginalFind(testPath) {
        console.log('⏱️  Starting original find operation...');
        
        if (global.gc) {
            global.gc();
            console.log('🗑️  Garbage collection performed');
        }
        
        const startTime = Date.now();
        const startSnapshot = emem.createEnhancedSnapshot('Original find start');
        
        console.log(`📈 Start Memory - Heap: ${startSnapshot.processMemory.heapUsed_MB}MB, RSS: ${startSnapshot.processMemory.rss_MB}MB`);
        
        try {
            const results = tl.find(testPath);
            const endTime = Date.now();
            const endSnapshot = emem.createEnhancedSnapshot('Original find complete', results.length);
            const duration = endTime - startTime;
            const memoryDelta = emem.calculateMemoryDelta(startSnapshot, endSnapshot);
            
            console.log('✅ Original find() completed successfully');
            console.log(`📁 Files found: ${results.length.toLocaleString()}`);
            console.log(`⏱️  Duration: ${this.formatDuration(duration)}`);
            console.log(`📈 End Memory - Heap: ${endSnapshot.processMemory.heapUsed_MB}MB, RSS: ${endSnapshot.processMemory.rss_MB}MB`);
            console.log(`📊 Memory Delta - Heap: ${memoryDelta.heapUsedDelta_MB.toFixed(1)}MB, RSS: ${memoryDelta.rssDelta_MB.toFixed(1)}MB`);
            
            return {
                approach: 'Original',
                success: true,
                filesFound: results.length,
                duration: duration,
                startMemory: startSnapshot.processMemory.heapUsed_MB * 1024 * 1024,
                endMemory: endSnapshot.processMemory.heapUsed_MB * 1024 * 1024,
                peakMemory: endSnapshot.processMemory.heapUsed_MB * 1024 * 1024,
                memoryDelta: memoryDelta.heapUsedDelta_MB * 1024 * 1024,
                // Enhanced metrics
                peakRSS_MB: endSnapshot.processMemory.rss_MB,
                rssDelta_MB: memoryDelta.rssDelta_MB,
                processMemoryStart: startSnapshot.processMemory,
                processMemoryEnd: endSnapshot.processMemory,
                error: null
            };
            
        } catch (error) {
            const endTime = Date.now();
            const endSnapshot = emem.createEnhancedSnapshot('Original find failed');
            
            console.log('❌ Original find() failed');
            console.log(`⏱️  Duration: ${this.formatDuration(endTime - startTime)}`);
            console.log(`❌ Error: ${error.message}`);
            
            return {
                approach: 'Original',
                success: false,
                filesFound: 0,
                duration: endTime - startTime,
                peakRSS_MB: endSnapshot.processMemory.rss_MB,
                error: error.message
            };
        }
    }

    /**
     * Test Generator approach with enhanced memory tracking
     */
    async testGeneratorFind(testPath) {
        console.log('\n⏸️  Waiting 3 seconds between tests...');
        await this.sleep(3000);
        
        console.log('🔄 Testing Generator find() with batch size 10000...');
        console.log('⏱️  Starting generator-based find operation...');
        
        if (global.gc) {
            global.gc();
            console.log('🗑️  Garbage collection performed');
        }
        
        const startTime = Date.now();
        const startSnapshot = emem.createEnhancedSnapshot('Generator find start');
        
        console.log(`📈 Start Memory - Heap: ${startSnapshot.processMemory.heapUsed_MB}MB, RSS: ${startSnapshot.processMemory.rss_MB}MB`);
        
        try {
            const result = tl.findWithMetrics(testPath, undefined, 10000, true);
            const endTime = Date.now();
            const endSnapshot = emem.createEnhancedSnapshot('Generator find complete', result.results.length);
            const duration = endTime - startTime;
            const memoryDelta = emem.calculateMemoryDelta(startSnapshot, endSnapshot);
            
            console.log('✅ Generator find() completed successfully');
            console.log(`📁 Files found: ${result.results.length.toLocaleString()}`);
            console.log(`⏱️  Duration: ${this.formatDuration(duration)}`);
            console.log(`📈 End Memory - Heap: ${endSnapshot.processMemory.heapUsed_MB}MB, RSS: ${endSnapshot.processMemory.rss_MB}MB`);
            console.log(`📊 Memory Delta - Heap: ${memoryDelta.heapUsedDelta_MB.toFixed(1)}MB, RSS: ${memoryDelta.rssDelta_MB.toFixed(1)}MB`);
            
            const metrics = result.metrics || {};
            console.log('📋 Generator Metrics:');
            console.log(`   📦 Batches Processed: ${metrics.batchesProcessed || Math.ceil(result.results.length / 10000)}`);
            console.log(`   📸 Memory Snapshots: ${metrics.memorySnapshots || 'N/A'}`);
            
            return {
                approach: 'Generator',
                success: true,
                filesFound: result.results.length,
                duration: duration,
                startMemory: startSnapshot.processMemory.heapUsed_MB * 1024 * 1024,
                endMemory: endSnapshot.processMemory.heapUsed_MB * 1024 * 1024,
                peakMemory: result.metrics?.peakMemoryMB ? result.metrics.peakMemoryMB * 1024 * 1024 : endSnapshot.processMemory.heapUsed_MB * 1024 * 1024,
                memoryDelta: memoryDelta.heapUsedDelta_MB * 1024 * 1024,
                // Enhanced metrics
                peakRSS_MB: endSnapshot.processMemory.rss_MB,
                rssDelta_MB: memoryDelta.rssDelta_MB,
                processMemoryStart: startSnapshot.processMemory,
                processMemoryEnd: endSnapshot.processMemory,
                batchesProcessed: metrics.batchesProcessed,
                error: null,
                metrics: result.metrics
            };
            
        } catch (error) {
            const endTime = Date.now();
            const endSnapshot = emem.createEnhancedSnapshot('Generator find failed');
            
            console.log('❌ Generator find() failed');
            console.log(`⏱️  Duration: ${this.formatDuration(endTime - startTime)}`);
            console.log(`❌ Error: ${error.message}`);
            
            return {
                approach: 'Generator',
                success: false,
                filesFound: 0,
                duration: endTime - startTime,
                peakRSS_MB: endSnapshot.processMemory.rss_MB,
                error: error.message
            };
        }
    }

    /**
     * Test Memory-Optimized approach with enhanced memory tracking
     */
    async testMemoryOptimizedFind(testPath) {
        console.log('\n⏸️  Waiting 3 seconds between tests...');
        await this.sleep(3000);
        
        console.log('🧠 Testing Memory-Optimized find() with adaptive strategies...');
        console.log('⏱️  Starting memory-optimized find operation...');
        
        if (global.gc) {
            global.gc();
            console.log('🗑️  Garbage collection performed');
        }
        
        const startTime = Date.now();
        const startSnapshot = emem.createEnhancedSnapshot('Memory-optimized find start');
        
        console.log(`📈 Start Memory - Heap: ${startSnapshot.processMemory.heapUsed_MB}MB, RSS: ${startSnapshot.processMemory.rss_MB}MB`);
        
        try {
            const result = tl.findMemoryOptimized(testPath, undefined, true);
            const endTime = Date.now();
            const endSnapshot = emem.createEnhancedSnapshot('Memory-optimized find complete', result.results.length);
            const duration = endTime - startTime;
            const memoryDelta = emem.calculateMemoryDelta(startSnapshot, endSnapshot);
            
            console.log('✅ Memory-optimized find() completed successfully');
            console.log(`📁 Files found: ${result.results.length.toLocaleString()}`);
            console.log(`⏱️  Duration: ${this.formatDuration(duration)}`);
            console.log(`📈 End Memory - Heap: ${endSnapshot.processMemory.heapUsed_MB}MB, RSS: ${endSnapshot.processMemory.rss_MB}MB`);
            console.log(`📊 Memory Delta - Heap: ${memoryDelta.heapUsedDelta_MB.toFixed(1)}MB, RSS: ${memoryDelta.rssDelta_MB.toFixed(1)}MB`);
            
            const metrics = result.metrics || {};
            console.log('📋 Memory-Optimized Metrics:');
            console.log(`   📸 Memory Snapshots: ${metrics.memorySnapshots || 2}`);
            console.log(`   🧠 Strategy Used: ${metrics.strategyUsed || 'Adaptive'}`);
            
            return {
                approach: 'Memory-Optimized',
                success: true,
                filesFound: result.results.length,
                duration: duration,
                startMemory: startSnapshot.processMemory.heapUsed_MB * 1024 * 1024,
                endMemory: endSnapshot.processMemory.heapUsed_MB * 1024 * 1024,
                peakMemory: result.metrics?.peakMemoryMB ? result.metrics.peakMemoryMB * 1024 * 1024 : endSnapshot.processMemory.heapUsed_MB * 1024 * 1024,
                memoryDelta: memoryDelta.heapUsedDelta_MB * 1024 * 1024,
                // Enhanced metrics
                peakRSS_MB: endSnapshot.processMemory.rss_MB,
                rssDelta_MB: memoryDelta.rssDelta_MB,
                processMemoryStart: startSnapshot.processMemory,
                processMemoryEnd: endSnapshot.processMemory,
                strategyUsed: metrics.strategyUsed,
                error: null,
                metrics: result.metrics
            };
            
        } catch (error) {
            const endTime = Date.now();
            const endSnapshot = emem.createEnhancedSnapshot('Memory-optimized find failed');
            
            console.log('❌ Memory-optimized find() failed');
            console.log(`⏱️  Duration: ${this.formatDuration(endTime - startTime)}`);
            console.log(`❌ Error: ${error.message}`);
            
            return {
                approach: 'Memory-Optimized',
                success: false,
                filesFound: 0,
                duration: endTime - startTime,
                peakRSS_MB: endSnapshot.processMemory.rss_MB,
                error: error.message
            };
        }
    }

    /**
     * Test Fast-Glob with enhanced memory tracking
     */
    async testFastGlob(testPath) {
        console.log('\n⏸️  Waiting 3 seconds between tests...');
        await this.sleep(3000);
        
        console.log('🚀 Testing Fast-Glob with recursive pattern...');
        console.log('⏱️  Starting fast-glob operation...');
        
        if (global.gc) {
            global.gc();
            console.log('🗑️  Garbage collection performed');
        }
        
        const startTime = Date.now();
        const startSnapshot = emem.createEnhancedSnapshot('Fast-Glob start');
        
        console.log(`📈 Start Memory - Heap: ${startSnapshot.processMemory.heapUsed_MB}MB, RSS: ${startSnapshot.processMemory.rss_MB}MB`);
        
        try {
            // Convert Windows path to Unix-style for fast-glob
            const pattern = path.join(testPath, '**/*').replace(/\\/g, '/');
            
            const results = await fg(pattern, {
                onlyFiles: false,        // Include directories like find() does
                followSymbolicLinks: true,
                stats: false,
                absolute: true,
                suppressErrors: true     // Don't throw on permission errors
            });
            
            const endTime = Date.now();
            const endSnapshot = emem.createEnhancedSnapshot('Fast-Glob complete', results.length);
            const duration = endTime - startTime;
            const memoryDelta = emem.calculateMemoryDelta(startSnapshot, endSnapshot);
            
            console.log('✅ Fast-Glob completed successfully');
            console.log(`📁 Files found: ${results.length.toLocaleString()}`);
            console.log(`⏱️  Duration: ${this.formatDuration(duration)}`);
            console.log(`📈 End Memory - Heap: ${endSnapshot.processMemory.heapUsed_MB}MB, RSS: ${endSnapshot.processMemory.rss_MB}MB`);
            console.log(`📊 Memory Delta - Heap: ${memoryDelta.heapUsedDelta_MB.toFixed(1)}MB, RSS: ${memoryDelta.rssDelta_MB.toFixed(1)}MB`);
            console.log(`📋 Fast-Glob Pattern: ${pattern}`);
            
            return {
                approach: 'Fast-Glob',
                success: true,
                filesFound: results.length,
                duration: duration,
                startMemory: startSnapshot.processMemory.heapUsed_MB * 1024 * 1024,
                endMemory: endSnapshot.processMemory.heapUsed_MB * 1024 * 1024,
                peakMemory: endSnapshot.processMemory.heapUsed_MB * 1024 * 1024,
                memoryDelta: memoryDelta.heapUsedDelta_MB * 1024 * 1024,
                // Enhanced metrics
                peakRSS_MB: endSnapshot.processMemory.rss_MB,
                rssDelta_MB: memoryDelta.rssDelta_MB,
                processMemoryStart: startSnapshot.processMemory,
                processMemoryEnd: endSnapshot.processMemory,
                pattern: pattern,
                error: null
            };
            
        } catch (error) {
            const endTime = Date.now();
            const endSnapshot = emem.createEnhancedSnapshot('Fast-Glob failed');
            
            console.log('❌ Fast-Glob failed');
            console.log(`⏱️  Duration: ${this.formatDuration(endTime - startTime)}`);
            console.log(`❌ Error: ${error.message}`);
            
            return {
                approach: 'Fast-Glob',
                success: false,
                filesFound: 0,
                duration: endTime - startTime,
                peakRSS_MB: endSnapshot.processMemory.rss_MB,
                error: error.message
            };
        }
    }

    /**
     * Print enhanced scale summary with process memory
     */
    printEnhancedScaleSummary(scaleResult) {
        console.log(`\n📊 === ENHANCED FOUR-WAY COMPARISON SUMMARY ===`);
        console.log(`Scale: Level ${scaleResult.scale} (${scaleResult.expectedItems.toLocaleString()} expected items)`);
        
        const orig = scaleResult.results.orig;
        const gen = scaleResult.results.gen;
        const mem = scaleResult.results.mem;
        const fg = scaleResult.results.fg;
        
        // Results comparison
        console.log('\n📋 Results Comparison:');
        if (orig) console.log(`   Original:        ${orig.success ? '✅' : '❌'} ${orig.success ? orig.filesFound.toLocaleString() + ' files' : orig.error}`);
        if (gen) console.log(`   Generator:       ${gen.success ? '✅' : '❌'} ${gen.success ? gen.filesFound.toLocaleString() + ' files' : gen.error}`);
        if (mem) console.log(`   Memory-Opt:      ${mem.success ? '✅' : '❌'} ${mem.success ? mem.filesFound.toLocaleString() + ' files' : mem.error}`);
        if (fg) console.log(`   Fast-Glob:       ${fg.success ? '✅' : '❌'} ${fg.success ? fg.filesFound.toLocaleString() + ' files' : fg.error}`);
        
        // Performance comparison
        const successfulResults = [orig, gen, mem, fg].filter(r => r && r.success);
        if (successfulResults.length > 0) {
            console.log(`\n⏱️  Performance Comparison (${successfulResults.length} successful):`);
            if (orig && orig.success) console.log(`   Original       : ${this.formatDuration(orig.duration)} (Heap Δ: ${emem.formatMemory(orig.memoryDelta)}MB, RSS Δ: ${orig.rssDelta_MB?.toFixed(1) || 'N/A'}MB)`);
            if (gen && gen.success) console.log(`   Generator      : ${this.formatDuration(gen.duration)} (Heap Δ: ${emem.formatMemory(gen.memoryDelta)}MB, RSS Δ: ${gen.rssDelta_MB?.toFixed(1) || 'N/A'}MB)`);
            if (mem && mem.success) console.log(`   Memory-Optimized: ${this.formatDuration(mem.duration)} (Heap Δ: ${emem.formatMemory(mem.memoryDelta)}MB, RSS Δ: ${mem.rssDelta_MB?.toFixed(1) || 'N/A'}MB)`);
            if (fg && fg.success) console.log(`   Fast-Glob      : ${this.formatDuration(fg.duration)} (Heap Δ: ${emem.formatMemory(fg.memoryDelta)}MB, RSS Δ: ${fg.rssDelta_MB?.toFixed(1) || 'N/A'}MB)`);
            
            // Winners analysis
            const fastest = successfulResults.reduce((a, b) => a.duration < b.duration ? a : b);
            const mostHeapEfficient = successfulResults.reduce((a, b) => a.peakMemory < b.peakMemory ? a : b);
            const mostRSSEfficient = successfulResults.reduce((a, b) => (a.peakRSS_MB || 0) < (b.peakRSS_MB || 0) ? a : b);
            
            console.log('\n🏆 ENHANCED WINNER ANALYSIS:');
            console.log(`   🏃 Fastest: ${fastest.approach} (${this.formatDuration(fastest.duration)})`);
            console.log(`   🧠 Most Heap Efficient: ${mostHeapEfficient.approach} (${emem.formatMemory(mostHeapEfficient.peakMemory)}MB)`);
            console.log(`   💾 Most RSS Efficient: ${mostRSSEfficient.approach} (${mostRSSEfficient.peakRSS_MB?.toFixed(1) || 'N/A'}MB)`);
        }
        
        console.log('\n' + '='.repeat(100));
    }

    /**
     * Print comprehensive results with enhanced metrics
     */
    printEnhancedComprehensiveResults() {
        console.log('\n' + '='.repeat(140));
        console.log('📊 ENHANCED COMPREHENSIVE SCALING RESULTS - ALL TESTS SUMMARY');
        console.log('='.repeat(140));
        
        // Enhanced Performance Summary Table
        console.log('\n📋 ENHANCED PERFORMANCE SUMMARY TABLE:');
        console.log('='.repeat(140));
        console.log('Scale'.padEnd(8) + 'Items'.padEnd(12) + 'Original'.padEnd(20) + 'Generator'.padEnd(20) + 'Memory-Opt'.padEnd(20) + 'Fast-Glob'.padEnd(20) + 'Speed Winner'.padEnd(15) + 'RSS Winner');
        console.log('-'.repeat(140));
        
        this.results.forEach(result => {
            const scale = `L${result.level}`.padEnd(8);
            const items = (result.expectedItems / 1000 + 'k').padEnd(12);
            
            const orig = result.results.orig?.success ? 
                `${this.formatDuration(result.results.orig.duration)} (${result.results.orig.peakRSS_MB?.toFixed(1) || 'N/A'}MB)` : 'FAILED';
            const gen = result.results.gen?.success ? 
                `${this.formatDuration(result.results.gen.duration)} (${result.results.gen.peakRSS_MB?.toFixed(1) || 'N/A'}MB)` : 'FAILED';
            const mem = result.results.mem?.success ? 
                `${this.formatDuration(result.results.mem.duration)} (${result.results.mem.peakRSS_MB?.toFixed(1) || 'N/A'}MB)` : 'FAILED';
            const fg = result.results.fg?.success ? 
                `${this.formatDuration(result.results.fg.duration)} (${result.results.fg.peakRSS_MB?.toFixed(1) || 'N/A'}MB)` : 'FAILED';
            
            const speedWinner = result.fastest ? result.fastest.approach.substring(0, 12) : 'None';
            const rssWinner = result.mostRSSEfficient ? result.mostRSSEfficient.approach.substring(0, 12) : 'None';
            
            console.log(scale + items + orig.padEnd(20) + gen.padEnd(20) + mem.padEnd(20) + fg.padEnd(20) + speedWinner.padEnd(15) + rssWinner);
        });
    }

    /**
     * Generate enhanced analysis with process memory insights
     */
    generateEnhancedAnalysis() {
        console.log('\n' + '='.repeat(120));
        console.log('🔬 ENHANCED PERFORMANCE ANALYSIS WITH PROCESS MEMORY');
        console.log('='.repeat(120));
        
        // Success rate analysis
        console.log('\n✅ Success Rates:');
        this.approaches.forEach(approach => {
            const successes = this.results.filter(r => r.results[approach.shortName]?.success).length;
            const rate = (successes / this.results.length * 100).toFixed(1);
            console.log(`   ${approach.name.padEnd(20)}: ${rate}% (${successes}/${this.results.length} scales)`);
        });
        
        // Enhanced memory analysis
        console.log('\n🧠 Enhanced Memory Analysis (RSS - Actual RAM Usage):');
        this.approaches.forEach(approach => {
            const successfulResults = this.results
                .map(r => r.results[approach.shortName])
                .filter(r => r && r.success && r.peakRSS_MB);
                
            if (successfulResults.length > 0) {
                const avgRSS = successfulResults.reduce((sum, r) => sum + r.peakRSS_MB, 0) / successfulResults.length;
                const minRSS = Math.min(...successfulResults.map(r => r.peakRSS_MB));
                const maxRSS = Math.max(...successfulResults.map(r => r.peakRSS_MB));
                
                console.log(`   ${approach.name.padEnd(20)}: Avg ${avgRSS.toFixed(1)}MB RSS, Min ${minRSS.toFixed(1)}MB, Max ${maxRSS.toFixed(1)}MB`);
            }
        });
        
        // Process memory vs Heap memory comparison
        console.log('\n💾 Process Memory vs Heap Memory Comparison:');
        const largestSuccessfulTest = this.results
            .filter(r => Object.values(r.results).some(res => res && res.success))
            .reduce((a, b) => a.expectedItems > b.expectedItems ? a : b, {});
            
        if (largestSuccessfulTest) {
            console.log(`\n   Largest Test Scale (${largestSuccessfulTest.expectedItems.toLocaleString()} items):`);
            Object.entries(largestSuccessfulTest.results).forEach(([key, result]) => {
                if (result && result.success) {
                    const heapMB = emem.formatMemory(result.peakMemory);
                    const rssMB = result.peakRSS_MB?.toFixed(1) || 'N/A';
                    const overhead = result.peakRSS_MB ? ((result.peakRSS_MB * 1024 * 1024 - result.peakMemory) / 1024 / 1024).toFixed(1) : 'N/A';
                    console.log(`      ${result.approach.padEnd(20)}: Heap ${heapMB}MB | RSS ${rssMB}MB | Overhead ${overhead}MB`);
                }
            });
        }
        
        // Fast-Glob specific analysis
        const fastGlobResults = this.results
            .map(r => r.results.fg)
            .filter(r => r && r.success);
            
        if (fastGlobResults.length > 0) {
            console.log('\n🚀 Fast-Glob Analysis:');
            const avgDuration = fastGlobResults.reduce((sum, r) => sum + r.duration, 0) / fastGlobResults.length;
            const avgRSS = fastGlobResults.reduce((sum, r) => sum + r.peakRSS_MB, 0) / fastGlobResults.length;
            
            console.log(`   Average Performance: ${this.formatDuration(avgDuration)}`);
            console.log(`   Average RSS Usage: ${avgRSS.toFixed(1)}MB`);
            console.log(`   Success Rate: ${((fastGlobResults.length / this.results.length) * 100).toFixed(1)}%`);
            
            // Compare with Memory-Optimized
            const memResults = this.results.map(r => r.results.mem).filter(r => r && r.success);
            if (memResults.length > 0) {
                const memAvgDuration = memResults.reduce((sum, r) => sum + r.duration, 0) / memResults.length;
                const memAvgRSS = memResults.reduce((sum, r) => sum + r.peakRSS_MB, 0) / memResults.length;
                
                const speedRatio = memAvgDuration / avgDuration;
                const memoryRatio = avgRSS / memAvgRSS;
                
                console.log(`   vs Memory-Optimized: ${speedRatio > 1 ? speedRatio.toFixed(1) + 'x faster' : (1/speedRatio).toFixed(1) + 'x slower'}`);
                console.log(`   vs Memory-Optimized: ${memoryRatio > 1 ? memoryRatio.toFixed(1) + 'x more memory' : (1/memoryRatio).toFixed(1) + 'x less memory'}`);
            }
        }
    }

    /**
     * Save enhanced results with process memory data
     */
    async saveEnhancedResults(filename = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultFilename = `enhanced-scaling-results-${timestamp}.json`;
        const outputFile = filename || defaultFilename;
        
        const systemInfo = emem.getSystemMemoryInfo();
        
        const resultsData = {
            timestamp: new Date().toISOString(),
            testType: 'Enhanced Scaling Test with Process Memory and Fast-Glob',
            system: {
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version,
                totalMemoryGB: systemInfo.totalGB,
                heapLimit: require('v8').getHeapStatistics().heap_size_limit,
                cpus: os.cpus().length
            },
            testConfiguration: {
                approaches: this.approaches.map(a => ({ name: a.name, shortName: a.shortName })),
                timeout: this.timeoutMs,
                scales: this.results.length,
                basePath: this.basePath,
                levels: this.levels,
                filesPerLevel: this.filesPerLevel
            },
            results: this.results,
            summary: {
                totalTests: this.results.length * this.approaches.length,
                successfulTests: this.results.reduce((sum, r) => 
                    sum + Object.values(r.results).filter(res => res && res.success).length, 0),
                fastestOverall: this.getFastestOverall(),
                mostMemoryEfficientOverall: this.getMostMemoryEfficientOverall(),
                mostRSSEfficientOverall: this.getMostRSSEfficientOverall()
            }
        };
        
        fs.writeFileSync(outputFile, JSON.stringify(resultsData, null, 2));
        console.log(`\n💾 Enhanced results saved to: ${outputFile}`);
        
        return outputFile;
    }

    // Helper methods
    getFastestOverall() {
        const allSuccessful = [];
        this.results.forEach(r => {
            Object.entries(r.results).forEach(([key, result]) => {
                if (result && result.success) {
                    allSuccessful.push({ ...result, scale: r.scale });
                }
            });
        });
        return allSuccessful.length > 0 ? 
            allSuccessful.reduce((a, b) => a.duration < b.duration ? a : b) : null;
    }

    getMostMemoryEfficientOverall() {
        const allSuccessful = [];
        this.results.forEach(r => {
            Object.entries(r.results).forEach(([key, result]) => {
                if (result && result.success) {
                    allSuccessful.push({ ...result, scale: r.scale });
                }
            });
        });
        return allSuccessful.length > 0 ? 
            allSuccessful.reduce((a, b) => a.peakMemory < b.peakMemory ? a : b) : null;
    }

    getMostRSSEfficientOverall() {
        const allSuccessful = [];
        this.results.forEach(r => {
            Object.entries(r.results).forEach(([key, result]) => {
                if (result && result.success && result.peakRSS_MB) {
                    allSuccessful.push({ ...result, scale: r.scale });
                }
            });
        });
        return allSuccessful.length > 0 ? 
            allSuccessful.reduce((a, b) => a.peakRSS_MB < b.peakRSS_MB ? a : b) : null;
    }

    // Utility methods
    formatDuration(ms) {
        if (ms < 1000) return `${ms.toFixed(0)}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    createTimeoutPromise(message) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(message)), this.timeoutMs);
        });
    }
}

/**
 * Main execution function with command line support
 */
async function main() {
    const args = process.argv.slice(2);
    let level = 1; // Default to level 1 (100k files)
    let basePath = 'C:\\RISHABH\\ADO\\Test';
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--level' || arg === '-l') {
            level = parseInt(args[i + 1]);
            if (isNaN(level) || level < 1 || level > 10) {
                console.error('❌ Level must be between 1 and 10');
                process.exit(1);
            }
            i++; // Skip next argument
        } else if (arg === '--path' || arg === '-p') {
            basePath = args[i + 1];
            i++; // Skip next argument
        } else if (arg === '--help' || arg === '-h') {
            console.log('🎯 Enhanced Scaling Performance Test');
            console.log('');
            console.log('Usage: node enhanced_scaling_performance_test.js [options]');
            console.log('');
            console.log('Options:');
            console.log('  --level, -l <number>   Test up to level N (1-10). Default: 1');
            console.log('                         Level 1 = 100k files, Level 2 = 200k files, etc.');
            console.log('  --path, -p <path>      Base path for testing. Default: C:\\RISHABH\\ADO\\Test');
            console.log('  --help, -h             Show this help message');
            console.log('');
            console.log('Examples:');
            console.log('  node enhanced_scaling_performance_test.js --level 1    # Test only 100k files');
            console.log('  node enhanced_scaling_performance_test.js --level 3    # Test 100k, 200k, 300k files');
            console.log('  node enhanced_scaling_performance_test.js --level 10   # Test all scales up to 1M files');
            console.log('');
            console.log('Memory Testing:');
            console.log('  Run with --expose-gc for accurate memory measurements:');
            console.log('  node --expose-gc enhanced_scaling_performance_test.js --level 1');
            process.exit(0);
        }
    }
    
    console.log('🎯 ENHANCED AZURE PIPELINES SCALING TEST');
    console.log('=========================================');
    console.log(`📍 Base Path: ${basePath}`);
    console.log(`📊 Testing Levels: 1 to ${level} (${level * 100}k files maximum)`);
    console.log(`⏱️  15 minute timeout per individual test`);
    console.log(`📊 Approaches: Original, Generator, Memory-Optimized, Fast-Glob`);
    console.log(`📈 Memory Tracking: Heap + Process (RSS) memory`);
    console.log('');
    
    try {
        // Initialize the enhanced test runner
        const tester = new EnhancedScalingPerformanceTest(basePath, level);
        
        console.log('🚀 Starting enhanced scaling tests...');
        console.log('');
        
        // Run the tests
        await tester.runEnhancedScalingTests();
        
        // Save results with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsFile = `enhanced-scaling-results-level${level}-${timestamp}.json`;
        await tester.saveEnhancedResults(resultsFile);
        
        console.log('');
        console.log('✅ All enhanced tests completed successfully!');
        console.log(`📁 Results saved to: ${resultsFile}`);
        
    } catch (error) {
        console.error('❌ Enhanced test execution failed:', error.message);
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

// Export for use in other scripts
module.exports = EnhancedScalingPerformanceTest;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}