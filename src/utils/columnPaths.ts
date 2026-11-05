import { isColumnObject, isTableOrViewObject, isValueSourceObject } from './symbols.js'

/*
 * The columns of a table, view or values can be grouped in plain objects:
 *
 *     coords = { lat: this.column('coords_lat', 'double'), lng: this.column('coords_lng', 'double') }
 *
 * The query builders and the SQL builders work with flat names: a column in a group is named by its path, 'coords.lat',
 * the same name a nested property of a select has. These helpers translate between both forms. A table is not always
 * made only of columns (it can have any other property), and the value of a column can be an object too (a custom type
 * with a json value), so it's always the definition, never the value, that says what is a group.
 */

export function isColumnsGroupCandidate(value: any): boolean {
    if (!value || typeof value !== 'object') {
        return false
    }
    if (value[isValueSourceObject] || value[isTableOrViewObject]) {
        return false
    }
    return value.constructor === Object // Plain object
}

interface ColumnsInfo {
    paths: string[]
    // Every group, with the paths of all the columns it has, at any depth
    groups: Map<string, string[]>
}

const columnsInfoOfTable = new WeakMap<object, ColumnsInfo>()
const columnsInfoOfShape = new WeakMap<object, ColumnsInfo>()

function collectColumnPaths(container: any, prefix: string, ancestors: object[], target: string[]): void {
    for (const property in container) {
        if (property.startsWith('__')) {
            continue
        }
        const value = container[property]
        if (!value || typeof value !== 'object') {
            continue
        }
        if (value[isColumnObject]) {
            target.push(prefix + property)
        } else if (isColumnsGroupCandidate(value) && !ancestors.includes(value)) {
            ancestors.push(value)
            collectColumnPaths(value, prefix + property + '.', ancestors, target)
            ancestors.pop()
        }
    }
}

function infoFromPaths(paths: string[]): ColumnsInfo {
    const groups = new Map<string, string[]>()
    for (const path of paths) {
        let dot = path.indexOf('.')
        while (dot >= 0) {
            const group = path.substring(0, dot)
            const leafs = groups.get(group)
            if (leafs) {
                leafs.push(path)
            } else {
                groups.set(group, [path])
            }
            dot = path.indexOf('.', dot + 1)
        }
    }
    return { paths, groups }
}

function columnsInfoOf(table: object): ColumnsInfo {
    let result = columnsInfoOfTable.get(table)
    if (!result) {
        const paths: string[] = []
        collectColumnPaths(table, '', [], paths)
        result = infoFromPaths(paths)
        columnsInfoOfTable.set(table, result)
    }
    return result
}

function shapeInfoOf(shape: object): ColumnsInfo {
    let result = columnsInfoOfShape.get(shape)
    if (!result) {
        result = infoFromPaths(Object.getOwnPropertyNames(shape))
        columnsInfoOfShape.set(shape, result)
    }
    return result
}

/** The names of the columns of a table, view or values; the ones in a group by its path. */
export function __columnPathsOf(table: object): string[] {
    return columnsInfoOf(table).paths
}

/**
 * The object to ask `name in …` when the shape is not set: it answers the same as the table, and also for the path of
 * the columns in a group.
 */
export function __tableWithColumnPaths(table: object): object {
    const result = Object.create(table)
    for (const path of columnsInfoOf(table).paths) {
        if (path.includes('.')) {
            result[path] = true
        }
    }
    return result
}

function flattenInto(info: ColumnsInfo, values: any, prefix: string, target: any): void {
    const properties = Object.getOwnPropertyNames(values)
    for (let i = 0, length = properties.length; i < length; i++) {
        const path = prefix + properties[i]!
        const value = values[properties[i]!]
        const leafs = info.groups.get(path)
        if (!leafs) {
            target[path] = value
        } else if (value === null || value === undefined) {
            // A group without value is every one of its columns without value
            for (let j = 0, length = leafs.length; j < length; j++) {
                target[leafs[j]!] = value
            }
        } else if (typeof value === 'object') {
            flattenInto(info, value, path + '.', target)
        } else {
            target[path] = value // Additional property, as any other in the object that is not a column
        }
    }
}

function flatten(info: ColumnsInfo, values: any): any {
    if (info.groups.size === 0 || !values || typeof values !== 'object') {
        return values
    }
    const properties = Object.getOwnPropertyNames(values)
    let hasGroup = false
    for (let i = 0, length = properties.length; i < length; i++) {
        if (info.groups.has(properties[i]!)) {
            hasGroup = true
            break
        }
    }
    if (!hasGroup) {
        return values
    }
    const result: any = {}
    flattenInto(info, values, '', result)
    return result
}

/** The values of a set, with the columns in a group by its path. When there is a shape, it says what is a group. */
export function __flattenSets(table: object, shape: object | undefined, values: any): any {
    return flatten(shape ? shapeInfoOf(shape) : columnsInfoOf(table), values)
}

/** The names received by methods like ignoreIfSet or keepOnly: the name of a group is all of its columns. */
export function __expandColumnNames(table: object, shape: object | undefined, names: any[]): any[] {
    const info = shape ? shapeInfoOf(shape) : columnsInfoOf(table)
    if (info.groups.size === 0) {
        return names
    }
    const result: any[] = []
    for (let i = 0, length = names.length; i < length; i++) {
        const leafs = info.groups.get(names[i])
        if (leafs) {
            result.push(...leafs)
        } else {
            result.push(names[i])
        }
    }
    return result
}

function flattenShapeInto(shape: any, prefix: string, target: any): void {
    const properties = Object.getOwnPropertyNames(shape)
    for (let i = 0, length = properties.length; i < length; i++) {
        const property = properties[i]!
        const value = shape[property]
        if (isColumnsGroupCandidate(value) && !value[isColumnObject]) {
            flattenShapeInto(value, prefix + property + '.', target)
        } else {
            target[prefix + property] = value
        }
    }
}

/** A shape with groups, with the properties in a group by its path. */
export function __flattenShape(shape: any): any {
    if (!shape) {
        return shape
    }
    const properties = Object.getOwnPropertyNames(shape)
    let hasGroup = false
    for (let i = 0, length = properties.length; i < length; i++) {
        if (isColumnsGroupCandidate(shape[properties[i]!])) {
            hasGroup = true
            break
        }
    }
    if (!hasGroup) {
        return shape
    }
    const result: any = {}
    flattenShapeInto(shape, '', result)
    return result
}
