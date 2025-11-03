/**
 * Quick test to verify enhanced scaling test setup
 */

const path = require('path');
const fs = require('fs');

async function quickTest() {
    console.log('🔧 ENHANCED SCALING TEST - SETUP VERIFICATION');
    console.log('===============================================');
    
    // Check if enhanced memory utils exist
    try {
        const emem = require('./enhanced-memory-utils');
        console.log('✅ Enhanced memory utils loaded');
        
        const memInfo = emem.getSystemMemoryInfo();
        console.log(`📊 System Memory: ${memInfo.totalGB}GB (${memInfo.usagePercent}% used)`);
        
        const snapshot = emem.createEnhancedSnapshot('Test snapshot');
        console.log(`💾 Current RSS: ${snapshot.processMemory.rss_MB}MB`);
        console.log(`🧠 Current Heap: ${snapshot.processMemory.heapUsed_MB}MB`);
    } catch (error) {
        console.log('❌ Enhanced memory utils not found:', error.message);
        return;
    }
    
    // Check if fast-glob is available
    try {
        const fg = require('fast-glob');
        console.log('✅ Fast-glob loaded');
    } catch (error) {
        console.log('❌ Fast-glob not found:', error.message);
        console.log('   Run: npm install fast-glob');
        return;
    }
    
    // Check if task library is built
    try {
        const tl = require('./_build/task');
        console.log('✅ Task library loaded');
    } catch (error) {
        console.log('❌ Task library not built:', error.message);
        console.log('   Run: npm run build');
        return;
    }
    
    // Check test directory structure
    const basePath = 'C:\\RISHABH\\ADO\\Test';
    console.log(`\n📁 Checking test directory structure: ${basePath}`);
    
    for (let level = 1; level <= 3; level++) {
        let testPath = basePath;
        if (level > 1) {
            for (let i = 2; i <= level; i++) {
                testPath = path.join(testPath, `level_${i}`);
            }
        }
        
        if (fs.existsSync(testPath)) {
            try {
                const items = fs.readdirSync(testPath);
                console.log(`✅ Level ${level}: ${testPath} (${items.length.toLocaleString()} items)`);
            } catch (error) {
                console.log(`⚠️  Level ${level}: ${testPath} (cannot read: ${error.message})`);
            }
        } else {
            console.log(`❌ Level ${level}: ${testPath} (not found)`);
        }
    }
    
    console.log('\n🚀 READY TO RUN TESTS!');
    console.log('======================');
    console.log('Quick test commands:');
    console.log('  npm run test:enhanced:1    # Test 100k files (Level 1)');
    console.log('  npm run test:enhanced:2    # Test up to 200k files (Levels 1-2)');
    console.log('  npm run test:enhanced:3    # Test up to 300k files (Levels 1-3)');
    console.log('');
    console.log('Manual commands:');
    console.log('  node --expose-gc enhanced_scaling_performance_test.js --level 1');
    console.log('  node --expose-gc run_enhanced_scaling_tests.js 1');
}

quickTest().catch(console.error);