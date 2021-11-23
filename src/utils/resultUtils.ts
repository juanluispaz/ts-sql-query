import type { AnyValueSource, ValueSourceValueTypeForObjectResult } from "../expressions/values"

// Result

export type ResultObjectValues<COLUMNS> = SplitResult<{
    [P in keyof COLUMNS]: ValueSourceValueTypeForObjectResult<COLUMNS[P]>
}>

// Picking

export type RequiredKeysOfPickingColumns<T> = T extends AnyValueSource ? never : { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T]
export type OptionalKeysOfPickingColumns<T> = T extends AnyValueSource ? never : { [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T]

// For compose and split

export type ColumnGuard<T> = T extends null | undefined ? never : T extends never ? never : T extends AnyValueSource ? never : unknown
export type GuidedObj<T> = T & { [K in keyof T as K extends string | number ? `${K}!` : never]-?: NonNullable<T[K]>} & { [K in keyof T as K extends string | number ? `${K}?` : never]?: T[K]}
export type GuidedPropName<T> = T extends `${infer Q}!` ? Q : T extends `${infer Q}?` ? Q : T
export type ValueOf<T> = T[keyof T]

export type SplitResult<RESULT> = 
    undefined extends string ? RESULT // tsc is working with strict mode disabled. There is no way to infer the optional properties. Keep as required is a better approximation.
    : { [P in MandatoryPropertiesOf<RESULT>]: RESULT[P] } & { [P in OptionalPropertiesOf<RESULT>]?: NonNullable<RESULT[P]> }
type MandatoryPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? never : (null extends TYPE[K] ? never : (undefined extends TYPE[K] ? never : K)) })[keyof TYPE]
type OptionalPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? K : (null extends TYPE[K] ? K : (undefined extends TYPE[K] ? K : never)) })[keyof TYPE]
