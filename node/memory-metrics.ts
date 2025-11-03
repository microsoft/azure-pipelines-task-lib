import * as fs from 'fs';
import * as path from 'path';
import { debug, warning } from './task';
import { IssueSource } from './internal';

/**
 * Interface for memory metrics tracking during find operations
 */
export interface FindMemoryMetrics {
    /** Memory used by the results array (in MB) */
    resultArrayMemoryMB: number;
    /** Memory used by the traversal stack (in MB) */
    stackMemoryMB: number;
    /** Peak memory usage during operation (in MB) */
    peakMemoryMB: number;
    /** Total number of files processed */
    filesProcessed: number;
    /** Maximum stack depth reached */
    maxStackDepth: number;
    /** Memory snapshots at different stages */
    snapshots: MemorySnapshot[];
    /** Number of batches processed (for generator approach) */
    batchesProcessed?: number;
}

/**
 * Memory snapshot at a specific point in time
 */
export interface MemorySnapshot {
    /** Timestamp of snapshot */
    timestamp: number;
    /** Number of results collected so far */
    resultCount: number;
    /** Current stack depth */
    stackDepth: number;
    /** Estimated memory usage in MB */
    estimatedMemoryMB: number;
    /** Description of operation at this point */
    description: string;
}

/**
 * Result interface that includes both results and optional metrics
 */
export interface FindWithMetricsResult {
    results: string[];
    metrics?: FindMemoryMetrics;
}

/**
 * Get current memory usage in MB
 */
export function getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
        const usage = process.memoryUsage();
        // Return heap used in MB
        return usage.heapUsed / (1024 * 1024);
    }
    return 0;
}

/**
 * Estimate memory usage of string array in MB
 */
export function estimateArrayMemory(results: string[]): number {
    if (results.length === 0) return 0;
    
    // Estimate: each string takes roughly 2 bytes per character + object overhead
    // Plus array overhead for pointers
    let totalChars = 0;
    for (const result of results) {
        totalChars += result.length;
    }
    
    // String memory (2 bytes per char) + array pointer overhead (8 bytes per entry) + array overhead
    const stringMemory = totalChars * 2;
    const pointerMemory = results.length * 8;
    const arrayOverhead = 64; // Base array object overhead
    
    return (stringMemory + pointerMemory + arrayOverhead) / (1024 * 1024);
}

/**
 * Estimate memory usage of traversal stack in MB
 */
export function estimateStackMemory(stackDepth: number, traversalChain: string[]): number {
    // Each _FindItem: path string + level number + object overhead
    const avgPathLength = 100; // Estimate average path length
    const itemSize = (avgPathLength * 2) + 8 + 32; // string + number + object overhead
    const stackMemory = stackDepth * itemSize;
    
    // Traversal chain memory
    let chainChars = 0;
    for (const path of traversalChain) {
        chainChars += path.length;
    }
    const chainMemory = (chainChars * 2) + (traversalChain.length * 8);
    
    return (stackMemory + chainMemory) / (1024 * 1024);
}

/**
 * Create a new memory snapshot
 */
export function createMemorySnapshot(
    resultCount: number,
    stackDepth: number,
    description: string
): MemorySnapshot {
    return {
        timestamp: Date.now(),
        resultCount,
        stackDepth,
        estimatedMemoryMB: getMemoryUsage(),
        description
    };
}

/**
 * Initialize a new FindMemoryMetrics object
 */
export function initializeMetrics(): FindMemoryMetrics {
    return {
        resultArrayMemoryMB: 0,
        stackMemoryMB: 0,
        peakMemoryMB: 0,
        filesProcessed: 0,
        maxStackDepth: 0,
        snapshots: []
    };
}

/**
 * Update metrics with current memory usage
 */
export function updateMetrics(
    metrics: FindMemoryMetrics,
    results: string[],
    stackDepth: number,
    traversalChain: string[]
): void {
    const currentMemory = getMemoryUsage();
    metrics.resultArrayMemoryMB = estimateArrayMemory(results);
    metrics.stackMemoryMB = Math.max(metrics.stackMemoryMB, estimateStackMemory(stackDepth, traversalChain));
    metrics.peakMemoryMB = Math.max(metrics.peakMemoryMB, currentMemory);
    metrics.maxStackDepth = Math.max(metrics.maxStackDepth, stackDepth);
    metrics.filesProcessed = results.length;
}

/**
 * Add a snapshot to metrics
 */
export function addSnapshot(
    metrics: FindMemoryMetrics,
    resultCount: number,
    stackDepth: number,
    description: string
): void {
    metrics.snapshots.push(createMemorySnapshot(resultCount, stackDepth, description));
}

/**
 * Log detailed memory metrics report
 */
export function logMemoryReport(metrics: FindMemoryMetrics, startTime: number): void {
    const duration = Date.now() - startTime;
    
    debug('=== Memory Metrics Report ===');
    debug(`Operation Duration: ${duration} ms`);
    debug(`Files Found: ${metrics.filesProcessed}`);
    debug(`Result Array Memory: ${metrics.resultArrayMemoryMB.toFixed(2)} MB`);
    debug(`Peak Stack Memory: ${metrics.stackMemoryMB.toFixed(2)} MB`);
    debug(`Peak Total Memory: ${metrics.peakMemoryMB.toFixed(2)} MB`);
    debug(`Max Stack Depth: ${metrics.maxStackDepth}`);
    debug(`Memory Efficiency: ${(metrics.filesProcessed / metrics.peakMemoryMB).toFixed(0)} files per MB`);
    
    // Log key snapshots
    debug('=== Key Memory Snapshots ===');
    metrics.snapshots.forEach((snapshot, index) => {
        debug(`${index + 1}. ${snapshot.description}`);
        debug(`   Time: +${snapshot.timestamp - startTime}ms, Files: ${snapshot.resultCount}, Memory: ${snapshot.estimatedMemoryMB.toFixed(2)}MB`);
    });
    
    // Performance analysis
    if (metrics.resultArrayMemoryMB > metrics.stackMemoryMB) {
        debug('📊 ANALYSIS: Result array consumes more memory than traversal stack');
        debug(`   Ratio: ${(metrics.resultArrayMemoryMB / metrics.stackMemoryMB).toFixed(1)}x more memory in results vs stack`);
    } else {
        debug('📊 ANALYSIS: Traversal stack consumes more memory than result array');
        debug(`   Ratio: ${(metrics.stackMemoryMB / metrics.resultArrayMemoryMB).toFixed(1)}x more memory in stack vs results`);
    }
    
    debug('=== End Memory Metrics Report ===');
}

/**
 * Check if we should take a snapshot based on batch count and file count
 */
export function shouldTakeSnapshot(batchCount: number, fileCount: number): boolean {
    return batchCount % 10 === 0 || fileCount % 10000 === 0;
}

/**
 * Generate description for batch processing snapshot
 */
export function getBatchDescription(batchCount: number, totalFiles: number): string {
    return `Batch ${batchCount} processed, ${totalFiles} files total`;
}

/**
 * Metadata for individual file paths in generator
 */
export interface FindItemMetadata {
    path: string;
    stackDepth: number;
}