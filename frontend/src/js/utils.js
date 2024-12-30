// utils.js
export function parseCoordinates(coord) {
    // Parse SGF coordinates (e.g., "aa" to [0, 0])
    const col = coord.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = coord.charCodeAt(1) - 'a'.charCodeAt(0);
    return [col, row];
}

export function safeStringify(obj, space = 2) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular]';
            }
            seen.add(value);
        }
        return value;
    }, space);
}
