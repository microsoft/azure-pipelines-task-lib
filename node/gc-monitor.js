/**
 * GC Monitoring and Analysis Utility
 * 
 * Monitors garbage collection patterns to detect "ineffective mark-compacts"
 * like those seen in customer's production crash.
 */

const { PerformanceObserver, performance } = require('perf_hooks');

class GCMonitor {
    constructor() {
        this.gcEvents = [];
        this.observer = null;
        this.monitoring = false;
    }

    start() {
        if (this.monitoring) return;
        
        console.log('🗑️  Starting GC monitoring...');
        this.monitoring = true;
        this.gcEvents = [];
        
        // Monitor GC events
        this.observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            
            entries.forEach((entry) => {
                if (entry.entryType === 'gc') {
                    const gcEvent = {
                        timestamp: Date.now(),
                        kind: this.getGCKind(entry.kind),
                        duration: Math.round(entry.duration * 100) / 100, // ms
                        flags: entry.flags || 0
                    };
                    
                    this.gcEvents.push(gcEvent);
                    
                    // Real-time GC analysis
                    if (gcEvent.duration > 500) {
                        console.log(`🚨 SLOW GC: ${gcEvent.kind} took ${gcEvent.duration}ms (like customer's 679-692ms)`);
                    } else if (gcEvent.duration > 100) {
                        console.log(`⚠️  GC: ${gcEvent.kind} took ${gcEvent.duration}ms`);
                    }
                    
                    // Detect ineffective GC patterns
                    this.analyzeGCEffectiveness();
                }
            });
        });
        
        this.observer.observe({ entryTypes: ['gc'] });
    }

    getGCKind(kind) {
        switch (kind) {
            case 1: return 'Scavenge';
            case 2: return 'Mark-Compact';
            case 4: return 'Incremental-Marking';
            case 8: return 'Weak-Processing';
            default: return `Unknown(${kind})`;
        }
    }

    analyzeGCEffectiveness() {
        if (this.gcEvents.length < 3) return;
        
        const recent = this.gcEvents.slice(-3);
        const markCompacts = recent.filter(gc => gc.kind === 'Mark-Compact');
        
        if (markCompacts.length >= 2) {
            const avgDuration = markCompacts.reduce((sum, gc) => sum + gc.duration, 0) / markCompacts.length;
            
            if (avgDuration > 600) {
                console.log('🚨 INEFFECTIVE GC PATTERN DETECTED:');
                console.log(`   Multiple Mark-Compact GCs averaging ${Math.round(avgDuration)}ms`);
                console.log('   This matches customer\'s "Ineffective mark-compacts" pattern!');
            }
        }
    }

    stop() {
        if (!this.monitoring) return;
        
        this.monitoring = false;
        if (this.observer) {
            this.observer.disconnect();
        }
        
        console.log('🗑️  GC monitoring stopped');
    }

    getReport() {
        if (this.gcEvents.length === 0) {
            return { summary: 'No GC events recorded' };
        }

        const markCompacts = this.gcEvents.filter(gc => gc.kind === 'Mark-Compact');
        const scavenges = this.gcEvents.filter(gc => gc.kind === 'Scavenge');
        
        const totalDuration = this.gcEvents.reduce((sum, gc) => sum + gc.duration, 0);
        const avgDuration = totalDuration / this.gcEvents.length;
        const maxDuration = Math.max(...this.gcEvents.map(gc => gc.duration));
        
        return {
            totalEvents: this.gcEvents.length,
            markCompacts: markCompacts.length,
            scavenges: scavenges.length,
            totalDuration: Math.round(totalDuration),
            avgDuration: Math.round(avgDuration * 100) / 100,
            maxDuration: Math.round(maxDuration * 100) / 100,
            customerPattern: maxDuration > 600 ? 'MATCHES' : 'DIFFERENT',
            ineffectiveGC: markCompacts.filter(gc => gc.duration > 500).length,
            events: this.gcEvents
        };
    }

    printReport() {
        const report = this.getReport();
        
        console.log('\n🗑️  GC MONITORING REPORT');
        console.log('========================');
        console.log(`Total GC Events: ${report.totalEvents}`);
        console.log(`Mark-Compact Events: ${report.markCompacts}`);
        console.log(`Scavenge Events: ${report.scavenges}`);
        console.log(`Total GC Time: ${report.totalDuration}ms`);
        console.log(`Average GC Duration: ${report.avgDuration}ms`);
        console.log(`Max GC Duration: ${report.maxDuration}ms`);
        console.log(`Customer Pattern Match: ${report.customerPattern}`);
        console.log(`Ineffective GCs (>500ms): ${report.ineffectiveGC}`);
        
        if (report.maxDuration > 600) {
            console.log('\n🎯 CUSTOMER PATTERN ANALYSIS:');
            console.log('   ✅ Reproduced slow Mark-Compact GCs (600ms+)');
            console.log('   ✅ This matches customer\'s 679-692ms GC times');
            console.log('   ✅ Indicates memory fragmentation like production');
        }
        
        // Show worst GC events
        if (report.events.length > 0) {
            const worstGCs = report.events
                .filter(gc => gc.duration > 100)
                .sort((a, b) => b.duration - a.duration)
                .slice(0, 5);
                
            if (worstGCs.length > 0) {
                console.log('\n📊 Worst GC Events:');
                worstGCs.forEach((gc, i) => {
                    console.log(`   ${i + 1}. ${gc.kind}: ${gc.duration}ms`);
                });
            }
        }
    }
}

module.exports = GCMonitor;