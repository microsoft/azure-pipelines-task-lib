/**
 * Simple test to verify both original and generator-based find functions work
 */

const tl = require('./_build/task');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a small test directory
const testDir = path.join(os.tmpdir(), 'find_test_simple');

function createTestStructure() {
    console.log('📁 Creating test structure...');
    
    // Clean and create base directory
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    
    // Create some files and directories
    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(testDir, 'file2.txt'), 'content2');
    
    const subDir = path.join(testDir, 'subdir');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'file3.txt'), 'content3');
    fs.writeFileSync(path.join(subDir, 'file4.txt'), 'content4');
    
    const subSubDir = path.join(subDir, 'subsubdir');
    fs.mkdirSync(subSubDir);
    fs.writeFileSync(path.join(subSubDir, 'file5.txt'), 'content5');
    
    console.log('✅ Test structure created');
}

function cleanup() {
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
        console.log('🗑️  Test structure cleaned up');
    }
}

function runTests() {
    console.log('🚀 SIMPLE FIND FUNCTIONS TEST');
    console.log('=============================');
    
    try {
        createTestStructure();
        
        console.log('\n🔍 Testing Original find()...');
        const originalResults = tl.find(testDir);
        console.log(`✅ Original find() found ${originalResults.length} items`);
        console.log('   Sample results:', originalResults.slice(0, 3));
        
        console.log('\n🔄 Testing Generator findGenerator()...');
        const generatorResults = tl.findGenerator(testDir);
        console.log(`✅ Generator findGenerator() found ${generatorResults.length} items`);
        console.log('   Sample results:', generatorResults.slice(0, 3));
        
        console.log('\n📊 Testing findWithMetrics()...');
        const metricsResult = tl.findWithMetrics(testDir, undefined, 100, true);
        console.log(`✅ findWithMetrics() found ${metricsResult.results.length} items`);
        if (metricsResult.metrics) {
            console.log(`   Result Array Memory: ${metricsResult.metrics.resultArrayMemoryMB.toFixed(4)} MB`);
            console.log(`   Stack Memory: ${metricsResult.metrics.stackMemoryMB.toFixed(4)} MB`);
            console.log(`   Max Stack Depth: ${metricsResult.metrics.maxStackDepth}`);
        }
        
        console.log('\n🔗 Testing findAndLogMetrics()...');
        const logResults = tl.findAndLogMetrics(testDir);
        console.log(`✅ findAndLogMetrics() found ${logResults.length} items`);
        
        // Compare results
        console.log('\n📋 COMPARISON:');
        console.log(`   Original: ${originalResults.length} items`);
        console.log(`   Generator: ${generatorResults.length} items`);
        console.log(`   WithMetrics: ${metricsResult.results.length} items`);
        console.log(`   LogMetrics: ${logResults.length} items`);
        
        const allSame = originalResults.length === generatorResults.length && 
                       generatorResults.length === metricsResult.results.length &&
                       metricsResult.results.length === logResults.length;
        
        console.log(`   Results Match: ${allSame ? '✅ All approaches found same number of items' : '❌ Mismatch in results'}`);
        
        // Sort and compare actual content
        const sortedOriginal = [...originalResults].sort();
        const sortedGenerator = [...generatorResults].sort();
        const contentMatch = JSON.stringify(sortedOriginal) === JSON.stringify(sortedGenerator);
        console.log(`   Content Match: ${contentMatch ? '✅ All approaches found identical items' : '❌ Content differs'}`);
        
        console.log('\n✅ All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        cleanup();
    }
}

// Run the tests
runTests();