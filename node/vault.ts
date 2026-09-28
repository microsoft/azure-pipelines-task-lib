
import fs = require('fs');
import path = require('path');
import crypto = require('crypto');

var algorithm = "aes-256-ctr";
var encryptEncoding: 'hex' = 'hex';
var unencryptedEncoding: 'utf8' = 'utf8';

//
// Store sensitive data in proc.
// Main goal: Protects tasks which would dump envvars from leaking secrets inadvertently
//            the task lib clears after storing.
// Also protects against a dump of a process getting the secrets
// The secret is generated and stored externally for the lifetime of the task.
//
export class Vault {
    constructor(keyPath: string) {
        this._keyFile = path.join(keyPath, '.taskkey');
        this._store = <{ [key: string]: string }>{};
        this.genKey();
    }

    private _keyFile: string;
    private _store: { [key: string]: string };

    public initialize(): void { }

    public storeSecret(name: string, data: string): boolean {
        if (!name || name.length == 0) {
            return false;
        }

        name = name.toLowerCase();

        if (!data || data.length == 0) {
            if (this._store.hasOwnProperty(name)) {
                delete this._store[name];
            }

            return false;
        }

        var key = this.getKey();
        var iv = crypto.randomBytes(16);

        var cipher = crypto.createCipheriv(algorithm, key, iv);
        var crypted = cipher.update(data, unencryptedEncoding, encryptEncoding)
        var cryptedFinal = cipher.final(encryptEncoding);

        this._store[name] = iv.toString(encryptEncoding) + crypted + cryptedFinal;
        return true;
    }

    public retrieveSecret(name: string): string | undefined {
        var secret: string | undefined;
        name = (name || '').toLowerCase();

        if (this._store.hasOwnProperty(name)) {
            var key = this.getKey();
            var data = this._store[name];
            var ivDataBuffer = Buffer.from(data, encryptEncoding);
            var iv = ivDataBuffer.slice(0, 16);
            var encryptedText = ivDataBuffer.slice(16);

            var decipher = crypto.createDecipheriv(algorithm, key, iv);
            var dec = decipher.update(encryptedText);
            var decFinal = decipher.final(unencryptedEncoding);

            secret = dec + decFinal;
        }

        return secret;
    }

    private getKey() {
        var key = fs.readFileSync(this._keyFile).toString('utf8');
        // Key needs to be hashed to correct length to match algorithm (aes-256-ctr)
        return crypto.createHash('sha256').update(key).digest();
    }

    private genKey(): void {
        let key;

        if (crypto.randomUUID) {
            key = crypto.randomUUID();
        } else {
            var bytes = crypto.randomBytes(16);
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            var hex = bytes.toString('hex');
            key = hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
        }

        fs.writeFileSync(this._keyFile, key, { encoding: 'utf8' });
    }
}
