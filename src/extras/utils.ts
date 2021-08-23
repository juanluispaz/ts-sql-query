import type { ITableOrView } from "../utils/ITableOrView"
import { Column, isColumn, OptionalColumn, __getColumnPrivate } from "../utils/Column"

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

type CapitalizedGuided<PREFIX extends string, KEY extends string, REFERENCE extends object> = KEY extends keyof REFERENCE
    ? (
        REFERENCE[KEY] extends Column 
        ? (
            REFERENCE[KEY] extends OptionalColumn
            ? `${PREFIX}${Capitalize<KEY>}`
            : `${PREFIX}${Capitalize<KEY>}!`
        ) : `${PREFIX}${Capitalize<KEY>}`
    ) : `${PREFIX}${Capitalize<KEY>}`

export function prefixMapForGuidedSplitCapitalized<O extends object, R extends ITableOrView<any> | { [KEY in keyof O]?: Column }, PREFIX extends string>(obj: O, reference: R, prefix: PREFIX): { [K in OnlyStringKey<keyof O> as K]: CapitalizedGuided<PREFIX, K, R> } {
    if (!obj) {
        return obj
    }
    const result: any = {}
    for (let key in obj) {
        const r = (reference as any)[key]
        if (isColumn(r) && !__getColumnPrivate(r).__isOptional) {
            result[key] = prefix + key.substr(0, 1).toUpperCase() + key.substr(1) + '!'
        } else {
            result[key] = prefix + key.substr(0, 1).toUpperCase() + key.substr(1)
        }
    }
    return result
}

type NameGuided<KEY extends string, REFERENCE extends object> = KEY extends keyof REFERENCE
    ? (
        REFERENCE[KEY] extends Column 
        ? (
            REFERENCE[KEY] extends OptionalColumn
            ? KEY
            : `${KEY}!`
        ) : KEY
    ) : KEY

export function mapForGuidedSplit<O extends object, R extends ITableOrView<any> | { [KEY in keyof O]?: Column } >(obj: O, reference: R): { [K in OnlyStringKey<keyof O> as K]: NameGuided<K, R> } {
    if (!obj) {
        return obj
    }
    const result: any = {}
    for (let key in obj) {
        const r = (reference as any)[key]
        if (isColumn(r) && !__getColumnPrivate(r).__isOptional) {
            result[key] = key + '!'
        } else {
            result[key] = key
        }
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

type DottedGuided<PREFIX extends string, KEY extends string, REFERENCE extends object> = KEY extends keyof REFERENCE
    ? (
        REFERENCE[KEY] extends Column 
        ? (
            REFERENCE[KEY] extends OptionalColumn
            ? `${PREFIX}.${KEY}`
            : `${PREFIX}.${KEY}!`
        ) : `${PREFIX}.${KEY}`
    ) : `${PREFIX}.${KEY}`

export function prefixMapForGuidedSplitDotted<O extends object, R extends ITableOrView<any> | { [KEY in keyof O]?: Column }, PREFIX extends string>(obj: O, reference: R, prefix: PREFIX): { [K in OnlyStringKey<keyof O> as K]: DottedGuided<PREFIX, K, R> } {
    if (!obj) {
        return obj
    }
    const result: any = {}
    for (let key in obj) {
        const r = (reference as any)[key]
        if (isColumn(r) && !__getColumnPrivate(r).__isOptional) {
            result[key] = prefix + '.' + key + '!'
        } else {
            result[key] = prefix + '.' + key
        }
    }
    return result
}

type ColumnKeys<O extends object> = { [K in keyof O]-?: O[K] extends Column ? K : never }[keyof O]

export function extractColumnsFrom<O extends object>(obj: O): { [K in ColumnKeys<O>]: O[K] } {
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