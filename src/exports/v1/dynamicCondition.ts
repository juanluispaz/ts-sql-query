// ts-sql-query/dynamicCondition: the path of version 1, kept so that code written for it keeps compiling. Each name says where
// it is imported from in version 2

export {
    /** @deprecated Use DynamicCondition, imported from 'ts-sql-query': a column of a type of yours is declared with its data type */
    type DynamicCondition,
    /** @deprecated Use DynamicCondition, imported from 'ts-sql-query': a column of a type of yours is declared with its data type */
    type DynamicCondition as TypeSafeDynamicCondition,
} from './expressions/dynamicConditionUsingFilters.js'

export {
    /** @deprecated Import it from 'ts-sql-query' */
    type DynamicPick,
    /** @deprecated Import it from 'ts-sql-query' */
    type DynamicPickPaths,
    /** @deprecated Import it from 'ts-sql-query' */
    type PickValuesPath,
    /** @deprecated Import it from 'ts-sql-query' */
    type PickValuesPathProjectedAsNullable,
    /** @deprecated Import it from 'ts-sql-query' */
    type PickValuesPathWithAllProperties,
    /** @deprecated Import it from 'ts-sql-query' */
    type PickValuesPathWithAllPropertiesProjectedAsNullable,
    /** @deprecated Import it from 'ts-sql-query' */
    type Pickable,
    /** @deprecated Import it from 'ts-sql-query' */
    dynamicPick,
    /** @deprecated Import it from 'ts-sql-query' */
    dynamicPickPaths,
    /** @deprecated Import it from 'ts-sql-query' */
    expandTypeFromDynamicPickPaths,
    /** @deprecated Import it from 'ts-sql-query' */
    expandTypeProjectedAsNullableFromDynamicPickPaths,
    /** @deprecated Use PickValuesPathWithAllProperties, imported from 'ts-sql-query' */
    type PickValuesPathWithAllProperties as PickValuesPathWitAllProperties,
    /** @deprecated Use PickValuesPathWithAllPropertiesProjectedAsNullable, imported from 'ts-sql-query' */
    type PickValuesPathWithAllPropertiesProjectedAsNullable as PickValuesPathWitAllPropertiesProjectedAsNullable,
} from '../v2/index.js'
