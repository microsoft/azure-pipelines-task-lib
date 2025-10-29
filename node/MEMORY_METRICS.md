# Memory Metrics for Azure Pipelines Task Library

This implementation provides detailed memory usage tracking for the `find()` function to help analyze and optimize memory consumption patterns.

## Files Added

### `memory-metrics.ts`
Contains all data models and utility functions for memory tracking:
- `FindMemoryMetrics` interface - Core metrics tracking structure
- `MemorySnapshot` interface - Point-in-time memory snapshots  
- `FindWithMetricsResult` interface - Return type with results and metrics
- Utility functions for memory estimation and reporting

### Enhanced `task.ts` Functions
Added new memory-aware functions while keeping existing `find()` unchanged:
- `findWithMetrics()` - Find with optional detailed memory tracking
- `findAndLogMetrics()` - Convenience function with automatic logging
- `_findGeneratorBatchedWithMetrics()` - Enhanced batch generator with metrics
- `_findGeneratorWithMetrics()` - Enhanced individual item generator with metrics

## Usage Examples

### 1. Basic Memory Tracking
```typescript
const tl = require('azure-pipelines-task-lib');

// Enable metrics collection
const result = tl.findWithMetrics('/large/directory', undefined, 1000, true);

console.log(`Found ${result.results.length} files`);
if (result.metrics) {
    console.log(`Result Array Memory: ${result.metrics.resultArrayMemoryMB.toFixed(2)} MB`);
    console.log(`Peak Stack Memory: ${result.metrics.stackMemoryMB.toFixed(2)} MB`);  
    console.log(`Peak Total Memory: ${result.metrics.peakMemoryMB.toFixed(2)} MB`);
    console.log(`Max Stack Depth: ${result.metrics.maxStackDepth}`);
}
```

### 2. Automatic Logging
```typescript
// Automatically logs detailed memory metrics
const files = tl.findAndLogMetrics('/large/directory');
console.log(`Found ${files.length} files`);
```

### 3. Existing API (No Changes)
```typescript
// Original find() function unchanged - no metrics collected
const files = tl.find('/some/directory');
```

## Memory Metrics Explained

### Key Metrics Tracked

1. **Result Array Memory (`resultArrayMemoryMB`)**
   - Memory consumed by the final results array
   - Grows linearly with number of files found
   - Shows if result accumulation is the primary memory consumer

2. **Stack Memory (`stackMemoryMB`)**  
   - Memory used by the traversal stack
   - Includes `_FindItem` objects and traversal chain
   - Shows if directory traversal logic is the primary memory consumer

3. **Peak Memory (`peakMemoryMB`)**
   - Maximum total memory usage during operation
   - Based on Node.js `process.memoryUsage().heapUsed`
   - Indicates overall memory footprint

4. **Stack Depth (`maxStackDepth`)**
   - Maximum depth of directory traversal stack
   - Helps identify deeply nested directory structures
   - Useful for understanding recursion patterns

### Memory Snapshots

The system takes snapshots at key points:
- Operation start
- Every 10 batches processed
- Every 10,000 files processed  
- Operation completion

Each snapshot includes:
- Timestamp
- Files processed so far
- Stack depth at that moment  
- Current memory usage
- Description of operation phase

### Analysis Output

The system automatically analyzes which component uses more memory:

```
📊 ANALYSIS: Result array consumes more memory than traversal stack
   Ratio: 3.2x more memory in results vs stack
```

This helps Sanju's team understand whether to focus optimization efforts on:
- **Result Array**: If results consume more memory → optimize result storage
- **Traversal Stack**: If stack consumes more memory → optimize directory traversal

## Testing the Implementation

Run the provided test script:
```bash
node test_memory_metrics.js
```

This creates a test directory structure and demonstrates:
1. Regular find() without metrics
2. findWithMetrics() with detailed tracking  
3. findAndLogMetrics() with automatic logging

## Integration with Existing Code

The implementation maintains 100% backward compatibility:
- Existing `find()` calls work unchanged
- No performance impact unless metrics are explicitly enabled
- New functions are opt-in additions

## Next Steps

1. **Validate with Large Repository**: Test with Sanju's candidate test checkout scenario
2. **Tune Thresholds**: Adjust snapshot intervals based on real-world usage
3. **Add Custom Metrics**: Extend for specific memory patterns discovered
4. **Performance Baseline**: Establish memory benchmarks for different directory sizes

This implementation provides the concrete numbers Sanju requested to determine whether the result array or traversal stack is the primary area for memory optimization focus.