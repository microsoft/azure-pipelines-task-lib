// Quick test of memory monitoring
const memMonitor = require('./memory-snapshot');

console.log('🧪 Testing Memory Monitor...');

// Quick check
console.log('\n1. Quick Check:');
memMonitor.getCurrentStatus();

// Single snapshot
console.log('\n2. Single Snapshot:');
const snapshot = memMonitor.snapshot();
console.log(`   Heap: ${snapshot.heapUsed}MB (${snapshot.heapUsedPercent}%)`);
console.log(`   RSS: ${snapshot.rss}MB`);
console.log(`   Available: ${snapshot.availableMemoryMB}MB`);

// Short monitoring test
console.log('\n3. Short Monitoring Test (5 seconds):');
memMonitor.start(1000);

setTimeout(() => {
    console.log('\n📊 Stopping monitor and generating report...');
    memMonitor.stop();
    memMonitor.report();
}, 5000);