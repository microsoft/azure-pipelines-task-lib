import { KeyValueStoreInterface } from './interfaces';

export class MockVariableStore implements KeyValueStoreInterface {
    // TODO: Use mock-taskrunner answers.
    private _store: { [key: string] : string } = {};

    deleteValue(key: string) {
        delete this._store[key];
    }

    getValue(key: string): string | undefined {
        return this._store[key];
    }

    setValue(key: string, value: string | undefined) {
        if (value === null || value === undefined || value === "") {
            return this.deleteValue(key);
        }

        this._store[key] = value;
    }
}
