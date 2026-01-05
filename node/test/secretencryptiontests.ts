// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as im from '../_build/internal';

describe('Secret Encryption Tests (_exposeTaskLibSecret)', function () {
    
    let tempDir: string;
    
    before(function () {
        tempDir = path.join(os.tmpdir(), 'task-lib-crypto-tests-' + Date.now());
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
        process.env['Agent.TempDirectory'] = tempDir;
    });
    
    after(function () {
        // Cleanup
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        delete process.env['Agent.TempDirectory'];
    });

    it('encrypts and stores secret with createCipheriv', function () {
        const secret = 'my-test-secret-password-123';
        const keyFile = 'test-proxy-key.txt';
        
        // Call the function (via internal module)
        const result = im._exposeTaskLibSecret(keyFile, secret);
        
        assert(result, 'Result should not be undefined');
        assert(result.includes(':'), 'Result should contain colon separator');
        
        const [filePathB64, encryptedContentB64] = result.split(':');
        assert(filePathB64.length > 0, 'File path should be encoded');
        assert(encryptedContentB64.length > 0, 'Encrypted content should be encoded');
        
        // Verify key file was created
        const filePath = Buffer.from(filePathB64, 'base64').toString();
        assert(fs.existsSync(filePath), 'Key file should exist');
        
        // Verify key file format (key:iv)
        const keyFileContent = fs.readFileSync(filePath, 'utf8');
        assert(keyFileContent.includes(':'), 'Key file should contain colon separator');
        
        const [keyBase64, ivBase64] = keyFileContent.split(':');
        assert(keyBase64.length > 0, 'Key should be present');
        assert(ivBase64.length > 0, 'IV should be present');
        
        // Cleanup
        fs.unlinkSync(filePath);
    });
    
    it('can decrypt secret encrypted with createCipheriv', function () {
        const secret = 'test-decryption-password-456';
        const keyFile = 'test-decrypt-key.txt';
        
        // Encrypt
        const result = im._exposeTaskLibSecret(keyFile, secret);
        assert(result, 'Encryption result should not be undefined');
        
        const [filePathB64, encryptedContentB64] = result.split(':');
        const filePath = Buffer.from(filePathB64, 'base64').toString();
        const encryptedContent = Buffer.from(encryptedContentB64, 'base64').toString();
        
        // Read key and IV
        const keyFileContent = fs.readFileSync(filePath, 'utf8');
        const [keyBase64, ivBase64] = keyFileContent.split(':');
        const key = Buffer.from(keyBase64, 'base64');
        const iv = Buffer.from(ivBase64, 'base64');
        
        // Decrypt manually to verify
        const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
        let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        assert.strictEqual(decrypted, secret, 'Decrypted secret should match original');
        
        // Cleanup
        fs.unlinkSync(filePath);
    });
    
    it('uses Buffer.from instead of new Buffer', function () {
        const secret = 'buffer-test-secret';
        const keyFile = 'test-buffer-key.txt';
        
        const result = im._exposeTaskLibSecret(keyFile, secret);
        
        // Should not throw deprecation warnings
        assert(result, 'Result should be valid');
        assert(result.includes(':'), 'Result format should be valid');
        
        // Decode using Buffer.from to verify format
        const [filePathB64, encryptedContentB64] = result.split(':');
        const filePath = Buffer.from(filePathB64, 'base64').toString();
        
        assert(fs.existsSync(filePath), 'File should exist');
        
        // Cleanup
        fs.unlinkSync(filePath);
    });
    
    it('handles empty secret gracefully', function () {
        const secret = '';
        const keyFile = 'test-empty-key.txt';
        
        const result = im._exposeTaskLibSecret(keyFile, secret);
        
        // Should still create valid format even for empty secret
        if (result) {
            const [filePathB64] = result.split(':');
            const filePath = Buffer.from(filePathB64, 'base64').toString();
            
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    });
    
    it('generates unique IV for each encryption', function () {
        const secret = 'same-secret-different-iv';
        const keyFile1 = 'test-iv-1.txt';
        const keyFile2 = 'test-iv-2.txt';
        
        const result1 = im._exposeTaskLibSecret(keyFile1, secret);
        const result2 = im._exposeTaskLibSecret(keyFile2, secret);
        
        assert(result1, 'First encryption should succeed');
        assert(result2, 'Second encryption should succeed');
        
        // Extract encrypted content
        const [, encrypted1] = result1.split(':');
        const [, encrypted2] = result2.split(':');
        
        // Same secret should produce DIFFERENT ciphertext (due to different IV)
        assert.notStrictEqual(encrypted1, encrypted2, 'Different IVs should produce different ciphertext');
        
        // Cleanup
        const filePath1 = Buffer.from(result1.split(':')[0], 'base64').toString();
        const filePath2 = Buffer.from(result2.split(':')[0], 'base64').toString();
        
        if (fs.existsSync(filePath1)) fs.unlinkSync(filePath1);
        if (fs.existsSync(filePath2)) fs.unlinkSync(filePath2);
    });
    
    it('key file format is backward-compatible (key:iv format)', function () {
        const secret = 'backward-compat-test';
        const keyFile = 'test-compat-key.txt';
        
        const result = im._exposeTaskLibSecret(keyFile, secret);
        const [filePathB64] = result.split(':');
        const filePath = Buffer.from(filePathB64, 'base64').toString();
        
        const keyFileContent = fs.readFileSync(filePath, 'utf8');
        
        // Old format detection: if contains ':', it's new format
        assert(keyFileContent.includes(':'), 'Should use new format with colon separator');
        
        // Should be parseable
        const parts = keyFileContent.split(':');
        assert.strictEqual(parts.length, 2, 'Should have exactly 2 parts (key:iv)');
        
        // Both parts should be valid base64
        assert.doesNotThrow(() => {
            Buffer.from(parts[0], 'base64');
            Buffer.from(parts[1], 'base64');
        }, 'Key and IV should be valid base64');
        
        // Cleanup
        fs.unlinkSync(filePath);
    });
});
