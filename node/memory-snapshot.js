/**
 * Memory Snapshot Utility
 * 
 * Provides real-time memory monitoring and snapshot capabilities
 * for tracking memory usage patterns in Azure Pipelines Task Library.
 * 
 * Usage:
 *   const memMonitor = require('./memory-snapshot');
 *   memMonitor.start();           // Start monitoring
 *   memMonitor.snapshot();        // Get current snapshot
 *   memMonitor.stop();            // Stop monitoring
 *   memMonitor.report();          // Show detailed report
 */

const { getProcessMemoryUsage } = require('./enhanced-memory-utils');

class MemoryMonitor {
    constructor() {
        this.snapshots = [];
        this.monitoring = false;
        this.monitorInterval = null;
        this.startTime = null;
    }

    /**
     * Get current memory snapshot
     */
    snapshot() {
        const v8 = require('v8');
        const heap = v8.getHeapStatistics();
        const process = getProcessMemoryUsage();
        
        const snapshot = {
            timestamp: Date.now(),
            elapsed: this.startTime ? Date.now() - this.startTime : 0,
            
            // Process Memory (RSS, heap from process.memoryUsage)
            rss: process.rss || 0,
            heapUsed: process.heapUsed || 0,
            heapTotal: process.heapTotal || 0,
            external: process.external || 0,
            arrayBuffers: process.arrayBuffers || 0,
            
            // V8 Heap Statistics (more detailed)
            v8: {
                totalHeapSize: Math.round(heap.total_heap_size / 1024 / 1024),
                totalHeapSizeExecutable: Math.round(heap.total_heap_size_executable / 1024 / 1024),
                totalPhysicalSize: Math.round(heap.total_physical_size / 1024 / 1024),
                totalAvailableSize: Math.round(heap.total_available_size / 1024 / 1024),
                usedHeapSize: Math.round(heap.used_heap_size / 1024 / 1024),
                heapSizeLimit: Math.round(heap.heap_size_limit / 1024 / 1024),
                mallocedMemory: Math.round(heap.malloced_memory / 1024 / 1024),
                peakMallocedMemory: Math.round(heap.peak_malloced_memory / 1024 / 1024),
                numberOfNativeContexts: heap.number_of_native_contexts,
                numberOfDetachedContexts: heap.number_of_detached_contexts
            },
            
            // Calculated metrics
            heapUsedPercent: Math.round((heap.used_heap_size / heap.heap_size_limit) * 100),
            heapTotalPercent: Math.round((heap.total_heap_size / heap.heap_size_limit) * 100),
            availableMemoryMB: Math.round((heap.heap_size_limit - heap.used_heap_size) / 1024 / 1024)
        };
        
        return snapshot;
    }

    /**
     * Start continuous monitoring
     */
    start(intervalMs = 2000) {
        if (this.monitoring) {
            console.log('📊 Memory monitoring already active');
            return;
        }

        this.startTime = Date.now();
        this.monitoring = true;
        this.snapshots = [];
        
        console.log(`📊 Starting memory monitoring (${intervalMs}ms intervals)`);
        
        // Take initial snapshot
        const initial = this.snapshot();
        this.snapshots.push(initial);
        this.displaySnapshot(initial, 'INITIAL');
        
        // Start monitoring interval
        this.monitorInterval = setInterval(() => {
            if (!this.monitoring) return;
            
            const snapshot = this.snapshot();
            this.snapshots.push(snapshot);
            this.displaySnapshot(snapshot);
            
            // Warnings for critical memory levels
            if (snapshot.heapUsedPercent > 90) {
                console.log('🚨 CRITICAL: Memory usage > 90% - crash imminent!');
            } else if (snapshot.heapUsedPercent > 80) {
                console.log('⚠️  WARNING: Memory usage > 80% - approaching limit!');
            } else if (snapshot.heapUsedPercent > 70) {
                console.log('📈 HIGH: Memory usage > 70%');
            }
            
        }, intervalMs);
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (!this.monitoring) {
            console.log('📊 Memory monitoring not active');
            return;
        }

        this.monitoring = false;
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        
        // Take final snapshot
        const final = this.snapshot();
        this.snapshots.push(final);
        this.displaySnapshot(final, 'FINAL');
        
        console.log('📊 Memory monitoring stopped');
    }

    /**
     * Display a single snapshot
     */
    displaySnapshot(snapshot, label = '') {
        const elapsed = Math.round(snapshot.elapsed / 1000);
        const prefix = label ? `[${label}] ` : '';
        
        console.log(`📊 ${prefix}Memory @${elapsed}s: RSS=${snapshot.rss}MB, Heap=${snapshot.heapUsed}MB (${snapshot.heapUsedPercent}% of ${snapshot.v8.heapSizeLimit}MB limit)`);
    }

    /**
     * Get current memory status without storing
     */
    getCurrentStatus() {
        const snapshot = this.snapshot();
        return {
            heapUsedMB: snapshot.heapUsed,
            heapUsedPercent: snapshot.heapUsedPercent,
            availableMB: snapshot.availableMemoryMB,
            rssMB: snapshot.rss,
            status: this.getMemoryStatus(snapshot.heapUsedPercent)
        };
    }

    /**
     * Get memory status indicator
     */
    getMemoryStatus(heapPercent) {
        if (heapPercent > 90) return 'CRITICAL';
        if (heapPercent > 80) return 'WARNING';
        if (heapPercent > 70) return 'HIGH';
        if (heapPercent > 50) return 'MODERATE';
        return 'NORMAL';
    }

    /**
     * Generate detailed memory report
     */
    report() {
        if (this.snapshots.length === 0) {
            console.log('📊 No memory snapshots available');
            return;
        }

        const first = this.snapshots[0];
        const last = this.snapshots[this.snapshots.length - 1];
        const peak = this.snapshots.reduce((max, snap) => 
            snap.heapUsedPercent > max.heapUsedPercent ? snap : max
        );

        console.log('\n📊 MEMORY MONITORING REPORT');
        console.log('============================');
        
        // Basic stats
        console.log(`🔧 Configuration:`);
        console.log(`   Heap Limit: ${first.v8.heapSizeLimit}MB`);
        console.log(`   Monitoring Duration: ${Math.round(last.elapsed / 1000)}s`);
        console.log(`   Snapshots Taken: ${this.snapshots.length}`);
        
        // Memory progression
        console.log(`\n📈 Memory Progression:`);
        console.log(`   Initial: RSS=${first.rss}MB, Heap=${first.heapUsed}MB (${first.heapUsedPercent}%)`);
        console.log(`   Peak:    RSS=${peak.rss}MB, Heap=${peak.heapUsed}MB (${peak.heapUsedPercent}%)`);
        console.log(`   Final:   RSS=${last.rss}MB, Heap=${last.heapUsed}MB (${last.heapUsedPercent}%)`);
        
        // Growth analysis
        const rssGrowth = last.rss - first.rss;
        const heapGrowth = last.heapUsed - first.heapUsed;
        
        console.log(`\n📊 Memory Growth:`);
        console.log(`   RSS Growth: ${rssGrowth > 0 ? '+' : ''}${rssGrowth}MB`);
        console.log(`   Heap Growth: ${heapGrowth > 0 ? '+' : ''}${heapGrowth}MB`);
        console.log(`   Peak Heap Usage: ${peak.heapUsedPercent}% of limit`);
        
        // Memory efficiency
        const avgHeap = Math.round(
            this.snapshots.reduce((sum, snap) => sum + snap.heapUsedPercent, 0) / this.snapshots.length
        );
        
        console.log(`\n🎯 Efficiency Metrics:`);
        console.log(`   Average Heap Usage: ${avgHeap}%`);
        console.log(`   Memory Stability: ${this.getStabilityRating()}`);
        console.log(`   Risk Level: ${this.getRiskLevel(peak.heapUsedPercent)}`);
        
        // Timeline (show key moments)
        if (this.snapshots.length > 5) {
            console.log(`\n⏱️  Key Timeline Moments:`);
            
            // Show first, peak moment, and last
            const keyMoments = [
                { snap: first, label: 'START' },
                { snap: peak, label: 'PEAK' },
                { snap: last, label: 'END' }
            ];
            
            keyMoments.forEach(moment => {
                const elapsed = Math.round(moment.snap.elapsed / 1000);
                console.log(`   ${moment.label}: ${elapsed}s - ${moment.snap.heapUsedPercent}% heap (${moment.snap.heapUsed}MB)`);
            });
        }
        
        // V8 detailed stats (from last snapshot)
        console.log(`\n🔍 V8 Engine Details (Final):`);
        console.log(`   Total Heap Size: ${last.v8.totalHeapSize}MB`);
        console.log(`   Used Heap Size: ${last.v8.usedHeapSize}MB`);
        console.log(`   Available Memory: ${last.availableMemoryMB}MB`);
        console.log(`   Malloced Memory: ${last.v8.mallocedMemory}MB`);
        console.log(`   Peak Malloced: ${last.v8.peakMallocedMemory}MB`);
        console.log(`   Native Contexts: ${last.v8.numberOfNativeContexts}`);
        console.log(`   Detached Contexts: ${last.v8.numberOfDetachedContexts}`);
    }

    /**
     * Get memory stability rating
     */
    getStabilityRating() {
        if (this.snapshots.length < 3) return 'INSUFFICIENT_DATA';
        
        const variations = [];
        for (let i = 1; i < this.snapshots.length; i++) {
            const diff = Math.abs(this.snapshots[i].heapUsedPercent - this.snapshots[i-1].heapUsedPercent);
            variations.push(diff);
        }
        
        const avgVariation = variations.reduce((sum, v) => sum + v, 0) / variations.length;
        
        if (avgVariation < 2) return 'VERY_STABLE';
        if (avgVariation < 5) return 'STABLE';
        if (avgVariation < 10) return 'MODERATE';
        if (avgVariation < 20) return 'UNSTABLE';
        return 'VERY_UNSTABLE';
    }

    /**
     * Get risk level based on peak memory usage
     */
    getRiskLevel(peakPercent) {
        if (peakPercent > 95) return 'EXTREME_RISK';
        if (peakPercent > 90) return 'HIGH_RISK';
        if (peakPercent > 80) return 'MODERATE_RISK';
        if (peakPercent > 70) return 'LOW_RISK';
        return 'MINIMAL_RISK';
    }

    /**
     * Export snapshots as JSON
     */
    exportSnapshots() {
        return {
            monitoring: {
                startTime: this.startTime,
                duration: this.startTime ? Date.now() - this.startTime : 0,
                snapshotCount: this.snapshots.length
            },
            snapshots: this.snapshots,
            summary: this.snapshots.length > 0 ? {
                initial: this.snapshots[0],
                final: this.snapshots[this.snapshots.length - 1],
                peak: this.snapshots.reduce((max, snap) => 
                    snap.heapUsedPercent > max.heapUsedPercent ? snap : max
                )
            } : null
        };
    }

    /**
     * Save report to file
     */
    saveReport(filename) {
        const fs = require('fs');
        const report = this.exportSnapshots();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filepath = filename || `memory-report-${timestamp}.json`;
        
        fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
        console.log(`📄 Memory report saved: ${filepath}`);
        return filepath;
    }

    /**
     * Quick memory check (one-liner)
     */
    static quickCheck() {
        const monitor = new MemoryMonitor();
        const snapshot = monitor.snapshot();
        console.log(`📊 Memory: ${snapshot.heapUsed}MB (${snapshot.heapUsedPercent}% of ${snapshot.v8.heapSizeLimit}MB) - ${monitor.getMemoryStatus(snapshot.heapUsedPercent)}`);
        return snapshot;
    }
}

// Create singleton instance
const memoryMonitor = new MemoryMonitor();

// Export both the class and singleton instance
module.exports = memoryMonitor;
module.exports.MemoryMonitor = MemoryMonitor;

// CLI usage
if (require.main === module) {
    console.log('📊 MEMORY SNAPSHOT UTILITY');
    console.log('==========================');
    
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage:');
        console.log('  node memory-snapshot.js              # Quick memory check');
        console.log('  node memory-snapshot.js --monitor    # Start monitoring for 30s');
        console.log('  node memory-snapshot.js --quick      # Quick snapshot');
        console.log('');
        console.log('In code:');
        console.log('  const mem = require("./memory-snapshot");');
        console.log('  mem.start();        // Start monitoring');
        console.log('  mem.snapshot();     // Take snapshot');
        console.log('  mem.stop();         // Stop and report');
        process.exit(0);
    }
    
    if (args.includes('--monitor')) {
        console.log('Starting 30-second memory monitoring demo...');
        memoryMonitor.start(1000); // 1 second intervals
        
        setTimeout(() => {
            memoryMonitor.stop();
            memoryMonitor.report();
        }, 30000);
        
    } else if (args.includes('--quick')) {
        MemoryMonitor.quickCheck();
        
    } else {
        // Default: show current snapshot
        const snapshot = memoryMonitor.snapshot();
        console.log('\n🔍 Current Memory Snapshot:');
        console.log(`   RSS: ${snapshot.rss}MB`);
        console.log(`   Heap Used: ${snapshot.heapUsed}MB`);
        console.log(`   Heap Total: ${snapshot.heapTotal}MB`);
        console.log(`   Heap Limit: ${snapshot.v8.heapSizeLimit}MB`);
        console.log(`   Heap Usage: ${snapshot.heapUsedPercent}%`);
        console.log(`   Available: ${snapshot.availableMemoryMB}MB`);
        console.log(`   Status: ${memoryMonitor.getMemoryStatus(snapshot.heapUsedPercent)}`);
    }
}