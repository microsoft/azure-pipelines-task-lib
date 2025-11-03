/**
 * Enhanced Memory Utilities for Comprehensive Performance Testing
 * 
 * Provides both heap memory and process memory (RSS) tracking
 * for more accurate memory usage analysis.
 */

const os = require('os');

/**
 * Get comprehensive process memory usage
 * @returns {object} Memory usage in MB with detailed breakdown
 */
function getProcessMemoryUsage() {
    const mem = process.memoryUsage();
    return {
        // Heap memory (V8 JavaScript heap)
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 1000) / 1000,
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 1000) / 1000,
        
        // Process memory (actual RAM usage)
        rssMB: Math.round(mem.rss / 1024 / 1024 * 1000) / 1000, // Most important: physical RAM
        
        // External memory (C++ objects, native modules)
        externalMB: Math.round(mem.external / 1024 / 1024 * 1000) / 1000,
        
        // ArrayBuffer memory
        arrayBuffersMB: Math.round(mem.arrayBuffers / 1024 / 1024 * 1000) / 1000,
        
        // Raw values for calculations
        raw: mem
    };
}

/**
 * Get current heap memory usage (compatible with existing code)
 * @returns {number} Heap usage in bytes
 */
function getMemoryUsage() {
    return process.memoryUsage().heapUsed;
}

/**
 * Create enhanced memory snapshot with both heap and process metrics
 * @param {string} description - Description of this measurement point
 * @param {number} resultCount - Number of results processed so far
 * @param {number} stackDepth - Current stack depth
 * @returns {object} Comprehensive memory snapshot
 */
function createEnhancedSnapshot(description, resultCount = 0, stackDepth = 0) {
    const memStats = getProcessMemoryUsage();
    const timestamp = Date.now();
    
    return {
        timestamp,
        resultCount,
        stackDepth,
        description,
        
        // Legacy compatibility
        estimatedMemoryMB: memStats.heapUsedMB,
        
        // Enhanced process metrics
        processMemory: {
            heapUsed_MB: memStats.heapUsedMB,
            heapTotal_MB: memStats.heapTotalMB,
            rss_MB: memStats.rssMB,           // Most important: actual RAM usage
            external_MB: memStats.externalMB,
            arrayBuffers_MB: memStats.arrayBuffersMB
        }
    };
}

/**
 * Calculate memory delta between two snapshots
 * @param {object} startSnapshot - Starting memory snapshot
 * @param {object} endSnapshot - Ending memory snapshot
 * @returns {object} Memory differences in MB
 */
function calculateMemoryDelta(startSnapshot, endSnapshot) {
    const start = startSnapshot.processMemory || {};
    const end = endSnapshot.processMemory || {};
    
    return {
        heapUsedDelta_MB: (end.heapUsed_MB || 0) - (start.heapUsed_MB || 0),
        heapTotalDelta_MB: (end.heapTotal_MB || 0) - (start.heapTotal_MB || 0),
        rssDelta_MB: (end.rss_MB || 0) - (start.rss_MB || 0),
        externalDelta_MB: (end.external_MB || 0) - (start.external_MB || 0),
        arrayBuffersDelta_MB: (end.arrayBuffers_MB || 0) - (start.arrayBuffers_MB || 0)
    };
}

/**
 * Format memory usage for display
 * @param {number} bytes - Memory in bytes
 * @returns {string} Formatted memory string
 */
function formatMemory(bytes) {
    const mb = bytes / 1024 / 1024;
    return mb.toFixed(1);
}

/**
 * Get system memory information
 * @returns {object} System memory stats
 */
function getSystemMemoryInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
        totalGB: Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10,
        freeGB: Math.round(freeMem / 1024 / 1024 / 1024 * 10) / 10,
        usedGB: Math.round(usedMem / 1024 / 1024 / 1024 * 10) / 10,
        usagePercent: Math.round(usedMem / totalMem * 100 * 10) / 10
    };
}

/**
 * Initialize enhanced metrics tracking
 * @returns {object} Enhanced metrics object
 */
function initializeEnhancedMetrics() {
    return {
        snapshots: [],
        peakMemoryMB: 0,
        peakRSS_MB: 0,
        peakExternal_MB: 0,
        startTime: Date.now(),
        systemInfo: getSystemMemoryInfo()
    };
}

module.exports = {
    getProcessMemoryUsage,
    getMemoryUsage, // Legacy compatibility
    createEnhancedSnapshot,
    calculateMemoryDelta,
    formatMemory,
    getSystemMemoryInfo,
    initializeEnhancedMetrics
};