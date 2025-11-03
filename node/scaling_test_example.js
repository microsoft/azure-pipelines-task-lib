/**
 * Example usage script for Azure Pipelines Scaling Tests
 * 
 * This script demonstrates how to use the scaling test generator and performance tester.
 */

console.log('🚀 AZURE PIPELINES SCALING TEST EXAMPLE');
console.log('========================================');
console.log();

console.log('📋 Available Commands:');
console.log();

console.log('1️⃣  GENERATE TEST STRUCTURE:');
console.log('   node scaling_test_generator.js generate [path]');
console.log('   # Creates nested folder structure with 100k items per level');
console.log('   # Example: node scaling_test_generator.js generate C:\\temp\\scaling-test');
console.log();

console.log('2️⃣  VALIDATE STRUCTURE:');
console.log('   node scaling_test_generator.js validate [path]');
console.log('   # Validates that the structure was created correctly');
console.log();

console.log('3️⃣  GET TEST PATHS:');
console.log('   node scaling_test_generator.js paths [path]');
console.log('   # Lists all available test paths for different scales');
console.log();

console.log('4️⃣  RUN PERFORMANCE TESTS:');
console.log('   node --expose-gc scaling_performance_test.js test [path]');
console.log('   # Runs comprehensive performance tests on all scales');
console.log('   # --expose-gc flag enables accurate memory testing');
console.log();

console.log('5️⃣  FULL SUITE (GENERATE + TEST):');
console.log('   node --expose-gc scaling_performance_test.js full [path]');
console.log('   # Generates structure and runs all tests in one command');
console.log();

console.log('6️⃣  CLEANUP:');
console.log('   node scaling_test_generator.js cleanup [path]');
console.log('   # Removes the generated test structure');
console.log();

console.log('📊 STRUCTURE DETAILS:');
console.log('   • Level 1: 1,000,000 items (10 nested levels)');
console.log('   • Level 2: 900,000 items (9 nested levels)');
console.log('   • Level 3: 800,000 items (8 nested levels)');
console.log('   • ...');
console.log('   • Level 10: 100,000 items (single level)');
console.log();

console.log('🧪 TESTED APPROACHES:');
console.log('   🔵 Original find() - Baseline recursive approach');
console.log('   🟢 Generator find() - Batched processing with metrics');
console.log('   🟡 Memory-Optimized find() - Adaptive memory management');
console.log();

console.log('💡 QUICK START EXAMPLE:');
console.log('   # Generate test structure');
console.log('   node scaling_test_generator.js generate');
console.log();
console.log('   # Run performance tests');
console.log('   node --expose-gc scaling_performance_test.js test');
console.log();
console.log('   # Or do both in one command');
console.log('   node --expose-gc scaling_performance_test.js full');
console.log();

console.log('⚠️  IMPORTANT NOTES:');
console.log('   • Tests require significant disk space (~1GB for full structure)');
console.log('   • Large scale tests may take 30+ minutes to complete');
console.log('   • Use --expose-gc flag for accurate memory measurements');
console.log('   • Results are saved to JSON files for analysis');
console.log();

console.log('📈 EXPECTED INSIGHTS:');
console.log('   • Performance degradation patterns as scale increases');
console.log('   • Memory efficiency comparison across approaches');
console.log('   • Breaking points where approaches start to fail');
console.log('   • Optimal approach selection based on dataset size');
console.log();

console.log('✅ Ready to start scaling tests!');
console.log('   Run any of the commands above to begin testing.');