// Generic key-value store. May or may not be case-sensitive.b
export interface KeyValueStoreInterface {
    deleteValue(key: string);
    getValue(key: string): string | undefined;
    setValue(key: string, value: string);
}
