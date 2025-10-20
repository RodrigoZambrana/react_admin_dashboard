type PlainObject = Record<string, unknown>

const isPlainObject = (value: unknown): value is PlainObject =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const clone = <T>(value: T): T => {
    if (Array.isArray(value)) {
        return [...value] as T
    }
    if (isPlainObject(value)) {
        return Object.entries(value).reduce((acc, [key, nested]) => {
            acc[key] = clone(nested)
            return acc
        }, {} as PlainObject) as T
    }
    return value
}

const deepMerge = <T extends PlainObject>(
    base: T,
    override: Partial<T> = {},
): T => {
    const result = clone(base)

    Object.entries(override).forEach(([key, value]) => {
        if (value === undefined) {
            return
        }

        const current = result[key]

        if (isPlainObject(current) && isPlainObject(value)) {
            result[key] = deepMerge(
                current as PlainObject,
                value as PlainObject,
            ) as unknown as T[typeof key]
            return
        }

        result[key] = clone(value) as T[typeof key]
    })

    return result as T
}

export default deepMerge
