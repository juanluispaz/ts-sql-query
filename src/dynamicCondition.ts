/*
 * Compatibility re-export to ease migration.
 *
 * The contents of this module moved to `./dynamic/pick.js` and `./dynamic/condition.js`.
 * This file re-exports the previous public surface from its new locations so existing
 * imports of `ts-sql-query/dynamicCondition` keep working. Prefer importing from the
 * `ts-sql-query/dynamic/*` subpaths (or the root `ts-sql-query` entry) going forward.
 */

export {
    dynamicPick,
    dynamicPickPaths,
    expandTypeFromDynamicPickPaths,
    expandTypeProjectedAsNullableFromDynamicPickPaths
} from './dynamic/pick.js'
export type {
    Pickable,
    DynamicPick,
    DynamicPickPaths,
    PickValuesPath,
    PickValuesPathWitAllProperties,
    PickValuesPathProjectedAsNullable,
    PickValuesPathWitAllPropertiesProjectedAsNullable
} from './dynamic/pick.js'
export type { DynamicCondition } from './dynamic/condition.js'
