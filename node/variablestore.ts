import { KeyValueStoreInterface } from './interfaces';

export class VariableStore implements KeyValueStoreInterface {
    deleteValue(key: string) {
        delete process.env[key];
    }

    getValue(key: string): string | undefined {
        return process.env[key];
    }

    setValue(key: string, value: string | undefined) {
        // TODO: Do we need to support deletions?
        if (value === null || value === undefined || value === "") {
            return this.deleteValue(key);
        }

        process.env[key] = value;
    }
}
