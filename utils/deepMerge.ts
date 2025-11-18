
// A more robust deep merge utility function.
function isObject(item: any): item is Object {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
    if (!sources.length) {
        return target;
    }
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject((source as any)[key])) {
                if (!(target as any)[key]) {
                    Object.assign(target, { [key]: {} });
                }
                deepMerge((target as any)[key], (source as any)[key]);
            } else {
                Object.assign(target, { [key]: (source as any)[key] });
            }
        }
    }

    return deepMerge(target, ...sources);
}
