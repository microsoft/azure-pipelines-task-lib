import { KeyValueStoreInterface } from './interfaces';

export class MockVariableStore implements KeyValueStoreInterface {
    private answers: { [key: string] : string };

    constructor(answers: { [key: string] : string }) {
        this.answers = answers;
    }

    deleteValue(key: string) {
        delete this.answers[key];
    }

    getValue(key: string): string | undefined {
        return this.answers[key];
    }

    setValue(key: string, value: string | undefined) {
        if (value === null || value === undefined || value === "") {
            return this.deleteValue(key);
        }

        this.answers[key] = value;
    }
}
