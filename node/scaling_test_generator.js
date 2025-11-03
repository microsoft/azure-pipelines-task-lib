/**
 * Scaling Test Generator for Azure Pipelines Task Library Find Functions
 * 
 * This script creates a nested folder structure for performance testing:
 * - Level 1: 1,000,000 items (root + 9 nested levels)
 * - Level 2: 900,000 items (root + 8 nested levels)
 * - Level 3: 800,000 items (root + 7 nested levels)
 * - ...
 * - Level 10: 100,000 items (single level)
 * 
 * Each level contains exactly 100,000 files and folders distributed as:
 * - 80,000 files (various extensions)
 * - 20,000 directories
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class ScalingTestGenerator {
    constructor(basePath = null) {
        this.basePath = basePath || path.join(os.tmpdir(), 'azure-pipelines-scaling-test');
        this.filesPerLevel = 100000;
        this.fileRatio = 0.8; // 80% files, 20% directories
        this.levels = 10;
        
        this.stats = {
            totalItemsCreated: 0,
            totalFilesCreated: 0,
            totalDirsCreated: 0,
            levelsCreated: 0,
            startTime: null,
            endTime: null
        };
    }

    /**
     * Generate the complete nested folder structure
     */
    async generateScalingStructure() {
        console.log('🚀 AZURE PIPELINES SCALING TEST GENERATOR');
        console.log('==========================================');
        console.log(`📁 Base Path: ${this.basePath}`);
        console.log(`📊 Total Levels: ${this.levels}`);
        console.log(`📦 Items per Level: ${this.filesPerLevel.toLocaleString()}`);
        console.log(`📄 File Ratio: ${(this.fileRatio * 100)}%`);
        console.log(`📂 Directory Ratio: ${((1 - this.fileRatio) * 100)}%`);
        
        // Cleanup existing structure
        if (fs.existsSync(this.basePath)) {
            console.log('🗑️  Cleaning up existing test structure...');
            await this._removeDirectory(this.basePath);
        }

        this.stats.startTime = Date.now();
        
        try {
            // Create base directory
            fs.mkdirSync(this.basePath, { recursive: true });
            console.log(`✅ Created base directory: ${this.basePath}`);
            
            // Generate nested structure
            await this._generateNestedLevels(this.basePath, this.levels);
            
            this.stats.endTime = Date.now();
            this._printStatistics();
            
            console.log('\n✅ Scaling test structure generation completed!');
            console.log(`🎯 Ready for performance testing with ${this.levels} different scales`);
            
        } catch (error) {
            console.error('❌ Error generating scaling structure:', error.message);
            throw error;
        }
    }

    /**
     * Generate nested levels recursively
     */
    async _generateNestedLevels(currentPath, remainingLevels) {
        if (remainingLevels <= 0) return;
        
        const levelNumber = this.levels - remainingLevels + 1;
        console.log(`\n🔄 Generating Level ${levelNumber} (${remainingLevels} levels remaining)...`);
        console.log(`📍 Path: ${currentPath}`);
        
        const levelStats = await this._generateLevel(currentPath, levelNumber);
        
        console.log(`✅ Level ${levelNumber} complete: ${levelStats.files.toLocaleString()} files, ${levelStats.dirs.toLocaleString()} dirs`);
        
        this.stats.totalFilesCreated += levelStats.files;
        this.stats.totalDirsCreated += levelStats.dirs;
        this.stats.totalItemsCreated += levelStats.files + levelStats.dirs;
        this.stats.levelsCreated++;
        
        // Create next nested level if needed
        if (remainingLevels > 1) {
            const nextLevelPath = path.join(currentPath, `level_${levelNumber + 1}`);
            fs.mkdirSync(nextLevelPath, { recursive: true });
            await this._generateNestedLevels(nextLevelPath, remainingLevels - 1);
        }
    }

    /**
     * Generate items for a single level
     */
    async _generateLevel(levelPath, levelNumber) {
        const totalItems = this.filesPerLevel;
        const numFiles = Math.floor(totalItems * this.fileRatio);
        const numDirs = totalItems - numFiles;
        
        const batchSize = 1000;
        let filesCreated = 0;
        let dirsCreated = 0;
        
        // Create files in batches
        for (let i = 0; i < numFiles; i += batchSize) {
            const currentBatch = Math.min(batchSize, numFiles - i);
            await this._createFileBatch(levelPath, i, currentBatch, levelNumber);
            filesCreated += currentBatch;
            
            // Progress indicator
            if (i % 10000 === 0) {
                process.stdout.write(`\r📄 Files: ${filesCreated.toLocaleString()}/${numFiles.toLocaleString()}`);
            }
        }
        
        console.log(`\r📄 Files: ${filesCreated.toLocaleString()}/${numFiles.toLocaleString()} ✅`);
        
        // Create directories in batches
        for (let i = 0; i < numDirs; i += batchSize) {
            const currentBatch = Math.min(batchSize, numDirs - i);
            await this._createDirBatch(levelPath, i, currentBatch, levelNumber);
            dirsCreated += currentBatch;
            
            // Progress indicator
            if (i % 5000 === 0) {
                process.stdout.write(`\r📂 Directories: ${dirsCreated.toLocaleString()}/${numDirs.toLocaleString()}`);
            }
        }
        
        console.log(`\r📂 Directories: ${dirsCreated.toLocaleString()}/${numDirs.toLocaleString()} ✅`);
        
        return { files: filesCreated, dirs: dirsCreated };
    }

    /**
     * Create a batch of files
     */
    async _createFileBatch(levelPath, startIndex, batchSize, levelNumber) {
        const extensions = ['.txt', '.js', '.json', '.md', '.log', '.xml', '.yml', '.conf', '.ini', '.cfg'];
        
        for (let i = 0; i < batchSize; i++) {
            const fileIndex = startIndex + i;
            const ext = extensions[fileIndex % extensions.length];
            const fileName = `file_L${levelNumber}_${fileIndex.toString().padStart(6, '0')}${ext}`;
            const filePath = path.join(levelPath, fileName);
            
            // Create small file with minimal content to save disk space
            const content = `Level ${levelNumber} File ${fileIndex}\nCreated: ${new Date().toISOString()}\n`;
            fs.writeFileSync(filePath, content, 'utf8');
        }
    }

    /**
     * Create a batch of directories
     */
    async _createDirBatch(levelPath, startIndex, batchSize, levelNumber) {
        for (let i = 0; i < batchSize; i++) {
            const dirIndex = startIndex + i;
            const dirName = `dir_L${levelNumber}_${dirIndex.toString().padStart(6, '0')}`;
            const dirPath = path.join(levelPath, dirName);
            
            fs.mkdirSync(dirPath, { recursive: true });
            
            // Add a small file inside each directory for realism
            const markerFile = path.join(dirPath, '.marker');
            fs.writeFileSync(markerFile, `Directory marker for Level ${levelNumber}, Dir ${dirIndex}\n`, 'utf8');
        }
    }

    /**
     * Remove directory recursively
     */
    async _removeDirectory(dirPath) {
        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);
            
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = fs.lstatSync(filePath);
                
                if (stat.isDirectory()) {
                    await this._removeDirectory(filePath);
                } else {
                    fs.unlinkSync(filePath);
                }
            }
            
            fs.rmdirSync(dirPath);
        }
    }

    /**
     * Print generation statistics
     */
    _printStatistics() {
        const duration = this.stats.endTime - this.stats.startTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        console.log('\n📊 === GENERATION STATISTICS ===');
        console.log(`⏱️  Total Duration: ${minutes}m ${seconds}s`);
        console.log(`📁 Levels Created: ${this.stats.levelsCreated}`);
        console.log(`📄 Total Files: ${this.stats.totalFilesCreated.toLocaleString()}`);
        console.log(`📂 Total Directories: ${this.stats.totalDirsCreated.toLocaleString()}`);
        console.log(`📦 Total Items: ${this.stats.totalItemsCreated.toLocaleString()}`);
        console.log(`💾 Estimated Size: ~${(this.stats.totalItemsCreated * 0.1).toFixed(1)} MB`);
    }

    /**
     * Validate the generated structure
     */
    async validateStructure() {
        console.log('\n🔍 VALIDATING GENERATED STRUCTURE');
        console.log('==================================');
        
        const validationResults = [];
        
        for (let level = 1; level <= this.levels; level++) {
            const levelPath = this._getLevelPath(level);
            const result = await this._validateLevel(levelPath, level);
            validationResults.push(result);
            
            if (result.isValid) {
                console.log(`✅ Level ${level}: ${result.totalItems.toLocaleString()} items (${result.files.toLocaleString()} files, ${result.dirs.toLocaleString()} dirs)`);
            } else {
                console.log(`❌ Level ${level}: Validation failed - Expected ${this.filesPerLevel.toLocaleString()}, Found ${result.totalItems.toLocaleString()}`);
            }
        }
        
        const allValid = validationResults.every(r => r.isValid);
        
        console.log('\n📊 === VALIDATION SUMMARY ===');
        console.log(`🎯 Structure Valid: ${allValid ? '✅ YES' : '❌ NO'}`);
        console.log(`📁 Levels Validated: ${validationResults.length}`);
        
        if (allValid) {
            console.log('🚀 Structure is ready for scaling performance tests!');
        } else {
            console.log('⚠️  Structure validation failed - regeneration may be needed');
        }
        
        return { isValid: allValid, results: validationResults };
    }

    /**
     * Get the path for a specific level
     */
    _getLevelPath(level) {
        let currentPath = this.basePath;
        
        for (let i = 2; i <= level; i++) {
            currentPath = path.join(currentPath, `level_${i}`);
        }
        
        return currentPath;
    }

    /**
     * Validate a specific level
     */
    async _validateLevel(levelPath, level) {
        if (!fs.existsSync(levelPath)) {
            return {
                level: level,
                isValid: false,
                error: 'Path does not exist',
                totalItems: 0,
                files: 0,
                dirs: 0
            };
        }
        
        try {
            const items = fs.readdirSync(levelPath);
            let files = 0;
            let dirs = 0;
            
            for (const item of items) {
                const itemPath = path.join(levelPath, item);
                const stat = fs.lstatSync(itemPath);
                
                if (stat.isDirectory()) {
                    dirs++;
                } else {
                    files++;
                }
            }
            
            const totalItems = files + dirs;
            const expectedItems = level === this.levels ? this.filesPerLevel : this.filesPerLevel + 1; // +1 for nested level directory
            const isValid = totalItems === expectedItems;
            
            return {
                level: level,
                isValid: isValid,
                totalItems: totalItems,
                files: files,
                dirs: dirs,
                expected: expectedItems
            };
            
        } catch (error) {
            return {
                level: level,
                isValid: false,
                error: error.message,
                totalItems: 0,
                files: 0,
                dirs: 0
            };
        }
    }

    /**
     * Get test paths for scaling tests
     */
    getScalingTestPaths() {
        const paths = [];
        
        for (let level = 1; level <= this.levels; level++) {
            const levelPath = this._getLevelPath(level);
            const expectedItems = level * this.filesPerLevel;
            
            paths.push({
                level: level,
                path: levelPath,
                expectedItems: expectedItems,
                description: `Level ${level} - ${expectedItems.toLocaleString()} items`
            });
        }
        
        return paths.reverse(); // Start with largest (1M) and go down to smallest (100k)
    }

    /**
     * Clean up the generated structure
     */
    async cleanup() {
        console.log('🗑️  Cleaning up scaling test structure...');
        
        if (fs.existsSync(this.basePath)) {
            await this._removeDirectory(this.basePath);
            console.log('✅ Cleanup completed');
        } else {
            console.log('ℹ️  No structure found to clean up');
        }
    }
}

/**
 * Main execution function
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'generate';
    const basePath = args[1];
    
    const generator = new ScalingTestGenerator(basePath);
    
    try {
        switch (command.toLowerCase()) {
            case 'generate':
                console.log('🎯 Generating scaling test structure...');
                await generator.generateScalingStructure();
                await generator.validateStructure();
                break;
                
            case 'validate':
                console.log('🔍 Validating existing structure...');
                await generator.validateStructure();
                break;
                
            case 'cleanup':
                console.log('🗑️  Cleaning up structure...');
                await generator.cleanup();
                break;
                
            case 'paths':
                console.log('📋 Getting test paths...');
                const paths = generator.getScalingTestPaths();
                console.log('\n📊 Available Test Paths:');
                paths.forEach(p => {
                    console.log(`   ${p.level.toString().padStart(2)}: ${p.path}`);
                    console.log(`       ${p.description}`);
                });
                break;
                
            default:
                console.log('❌ Unknown command. Available commands:');
                console.log('   generate [path] - Generate the scaling test structure');
                console.log('   validate [path] - Validate existing structure');
                console.log('   cleanup [path]  - Clean up the structure');
                console.log('   paths [path]    - List test paths');
                process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Operation failed:', error.message);
        process.exit(1);
    }
}

// Export for use in other scripts
module.exports = ScalingTestGenerator;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}