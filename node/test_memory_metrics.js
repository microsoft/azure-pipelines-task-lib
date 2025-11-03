// Test script to demonstrate memory metrics functionality
const tl = require('./_build/task');

// Create a test directory with some files
const testDir = 'memory_test_dir';
const fs = require('fs');
const path = require('path');

function createTestDirectory() {
    console.log('Creating test directory with files...');
    
    // Create test directory
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir);
    }
    
    // Create subdirectories and files
    for (let i = 1; i <= 3; i++) {
        const subDir = path.join(testDir, `subdir${i}`);
        if (!fs.existsSync(subDir)) {
            fs.mkdirSync(subDir);
        }
        
        // Create files in each subdirectory
        for (let j = 1; j <= 10; j++) {
            const filePath = path.join(subDir, `file${j}.txt`);
            fs.writeFileSync(filePath, `Content for file ${j} in subdir ${i}`);
        }
    }
    
    // Create some files in root test directory
    for (let k = 1; k <= 5; k++) {
        const filePath = path.join(testDir, `root_file${k}.txt`);
        fs.writeFileSync(filePath, `Root file ${k} content`);
    }
    
    console.log('Test directory created successfully!');
}

function cleanupTestDirectory() {
    console.log('Cleaning up test directory...');
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    console.log('Cleanup complete!');
}

function runMemoryTests() {
    console.log('\n=== Testing Find with Memory Metrics ===\n');
    
    // Test 1: Regular find (no metrics)
    console.log('1. Regular find() - no metrics:');
    const regularResults = tl.find(testDir);
    console.log(`   Found ${regularResults.length} items\n`);
    
    // Test 2: Find with metrics enabled
    console.log('2. findWithMetrics() - with detailed tracking:');
    const metricsResult = tl.findWithMetrics(testDir, undefined, 10, true);
    console.log(`   Found ${metricsResult.results.length} items`);
    if (metricsResult.metrics) {
        console.log(`   Result Array Memory: ${metricsResult.metrics.resultArrayMemoryMB.toFixed(3)} MB`);
        console.log(`   Peak Stack Memory: ${metricsResult.metrics.stackMemoryMB.toFixed(3)} MB`);
        console.log(`   Peak Total Memory: ${metricsResult.metrics.peakMemoryMB.toFixed(3)} MB`);
        console.log(`   Max Stack Depth: ${metricsResult.metrics.maxStackDepth}`);
        console.log(`   Snapshots Taken: ${metricsResult.metrics.snapshots.length}\n`);
    }
    
    // Test 3: Find with metrics and logging
    console.log('3. findAndLogMetrics() - with automatic logging:');
    const loggedResults = tl.findAndLogMetrics(testDir, undefined, 5);
    console.log(`   Found ${loggedResults.length} items with detailed logging\n`);
}

// Main execution
try {
    createTestDirectory();
    runMemoryTests();
} catch (error) {
    console.error('Error during testing:', error.message);
} finally {
    cleanupTestDirectory();
}

console.log('Memory metrics testing complete!');