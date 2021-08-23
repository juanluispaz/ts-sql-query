import { Column, isColumn } from "../utils/Column"

type OnlyStringKey<KEY> = KEY extends string ? KEY : never

export function prefixCapitalized<O extends object, PREFIX extends string>(obj: O, prefix: PREFIX): { [K in OnlyStringKey<keyof O> as `${PREFIX}${Capitalize<K>}`]: O[K] } {
    if (!obj) {
        return obj
    }
    const result: any = {}
    for (let key in obj) {
        result[prefix + key.substr(0, 1).toUpperCase() + key.substr(1)] = obj[key]
    }
    return result
}

export function prefixMapForSplitCapitalized<O extends object, PREFIX extends string>(obj: O, prefix: PREFIX): { [K in OnlyStringKey<keyof O> as K]: `${PREFIX}${Capitalize<K>}` } {
    if (!obj) {
        return obj
    }
    const result: any = {}
    for (let key in obj) {
        result[key] = prefix + key.substr(0, 1).toUpperCase() + key.substr(1)
    }
    return result
}

export function prefixDotted<O extends object, PREFIX extends string>(obj: O, prefix: PREFIX): { [K in OnlyStringKey<keyof O> as `${PREFIX}.${K}`]-?: O[K] } {
    if (!obj) {
        return obj
    }
    const result: any = {}
    for (let key in obj) {
        result[prefix + '.' + key] = obj[key]
    }
    return result
}

export function prefixMapForSplitDotted<O extends object, PREFIX extends string>(obj: O, prefix: PREFIX): { [K in OnlyStringKey<keyof O> as K]-?: `${PREFIX}.${K}` } {
    if (!obj) {
        return obj
    }
    const result: any = {}
    for (let key in obj) {
        result[key] = prefix + '.' + key
    }
    return result
}

type ColumnKeys<O extends object> = { [K in keyof O]-?: O[K] extends Column ? K : never }[keyof O]

export function extractColumnsFrom<O extends object>(obj: O): { [K in ColumnKeys<O>​]: O[K] } {
    if (!obj) {
        return obj
    }
    const result: any = {}
    for (let key in obj) {
        const value = obj[key]
        if (isColumn(value)) {
            result[key] = value
        }
    }
    return result
}