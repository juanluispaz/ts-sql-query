import type { AnyValueSource } from "../expressions/values"
import type { Expand, RequiredKeys, UsableKeyOf } from "../utils/objectUtils"

type ExtractFirstPropertyInPath<PATH extends string> = PATH extends `${infer FIRST}.${any}` ? FIRST : never
type UnprefixPath<NAME extends string, PREFIX extends string> = NAME extends `${PREFIX}.${infer R}` ? R : never
type UnprefixPathExtractFirstProperty<NAME extends string, PREFIX extends string> = NAME extends `${PREFIX}.${infer R}` ? R | ExtractFirstPropertyInPath<R>: never

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export type PickablePaths<TYPE> =
    undefined extends TYPE
    ? never
    : TYPE extends AnyValueSource
    ? ''
    : { [KEY in RequiredKeys<TYPE>] : PickablePaths2<TYPE[KEY], `${KEY}`> }[RequiredKeys<TYPE>]

type PickablePaths2<TYPE, PREFIX extends string> =
    undefined extends TYPE
    ? never
    : TYPE extends AnyValueSource
    ? `${PREFIX}`
    : { [KEY in RequiredKeys<TYPE>] : PickablePaths3<TYPE[KEY], `${PREFIX}.${KEY}`> }[RequiredKeys<TYPE>] | `${PREFIX}`

type PickablePaths3<TYPE, PREFIX extends string> =
    undefined extends TYPE
    ? never
    : TYPE extends AnyValueSource
    ? `${PREFIX}`
    : { [KEY in RequiredKeys<TYPE>] : PickablePaths4<TYPE[KEY], `${PREFIX}.${KEY}`> }[RequiredKeys<TYPE>] | `${PREFIX}`

type PickablePaths4<TYPE, PREFIX extends string> =
    undefined extends TYPE
    ? never
    : TYPE extends AnyValueSource
    ? `${PREFIX}`
    : { [KEY in RequiredKeys<TYPE>] : PickablePaths5<TYPE[KEY], `${PREFIX}.${KEY}`> }[RequiredKeys<TYPE>] | `${PREFIX}`

type PickablePaths5<TYPE, PREFIX extends string> =
    undefined extends TYPE
    ? never
    : TYPE extends AnyValueSource
    ? `${PREFIX}`
    : never
    
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export type PickingAsBooleanObjectMap<TYPE, EXCLUDE extends string> =
    undefined extends TYPE
    ? never
    : TYPE extends AnyValueSource
    ? boolean
    : Expand<{ [KEY in Exclude<RequiredKeys<TYPE>, EXCLUDE>]? : PickingAsBooleanObjectMap2<TYPE[KEY], UnprefixPath<EXCLUDE, KEY>> }>

type PickingAsBooleanObjectMap2<TYPE, EXCLUDE extends string> =
    undefined extends TYPE
    ? never
    : TYPE extends AnyValueSource
    ? boolean
    : Expand<{ [KEY in Exclude<RequiredKeys<TYPE>, EXCLUDE>]? : PickingAsBooleanObjectMap3<TYPE[KEY], UnprefixPath<EXCLUDE, KEY>> }>

type PickingAsBooleanObjectMap3<TYPE, EXCLUDE extends string> =
    undefined extends TYPE
    ? never
    : TYPE extends AnyValueSource
    ? boolean
    : Expand<{ [KEY in Exclude<RequiredKeys<TYPE>, EXCLUDE>]? : PickingAsBooleanObjectMap4<TYPE[KEY], UnprefixPath<EXCLUDE, KEY>> }>

type PickingAsBooleanObjectMap4<TYPE, EXCLUDE extends string> =
    undefined extends TYPE
    ? never
    : TYPE extends AnyValueSource
    ? boolean
    : Expand<{ [KEY in Exclude<RequiredKeys<TYPE>, EXCLUDE>]? : PickingAsBooleanObjectMap5<TYPE[KEY]> }>

type PickingAsBooleanObjectMap5<TYPE> =
    undefined extends TYPE
    ? never
    : TYPE extends AnyValueSource
    ? boolean
    : never

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
 * Create a object where all non-mandatories properties are marked as
 * optionals, keeping in mind that only apply for the innnermost elements
 * 
 * ExtractFirstProperty is used to avoid required objects where all inside
 * is optional
 */

export type PickWitOthersAsOptionals<TYPE, MANDATORY extends string> = PickWitOthersAsOptionals1<TYPE, MANDATORY | ExtractFirstPropertyInPath<MANDATORY>, false>

type PickWitOthersAsOptionals1<TYPE, MANDATORY_AT_LEVEL extends string, MANDATORY_PARENT> = Expand<{ 
        [K in MadatoriyValuesKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: TYPE[K] 
    } & {
        [K in MandatoryNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: 
            PickWitOthersAsOptionals2<TYPE[K], UnprefixPathExtractFirstProperty<MANDATORY_AT_LEVEL, K>, InMandatory<K, MANDATORY_AT_LEVEL, MANDATORY_PARENT>>
    } & {
        [K in OptionalValueKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]?: TYPE[K]
    } & {
        [K in OptionalNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]?: 
            PickWitOthersAsOptionals2<TYPE[K], UnprefixPathExtractFirstProperty<MANDATORY_AT_LEVEL, K>, InMandatory<K, MANDATORY_AT_LEVEL, MANDATORY_PARENT>>
    }
>

type PickWitOthersAsOptionals2<TYPE, MANDATORY_AT_LEVEL extends string, MANDATORY_PARENT> = Expand<{ 
        [K in MadatoriyValuesKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: TYPE[K] 
    } & {
        [K in MandatoryNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: 
            PickWitOthersAsOptionals3<TYPE[K], UnprefixPathExtractFirstProperty<MANDATORY_AT_LEVEL, K>, InMandatory<K, MANDATORY_AT_LEVEL, MANDATORY_PARENT>>
    } & {
        [K in OptionalValueKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]?: TYPE[K]
    } & {
        [K in OptionalNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]?: 
            PickWitOthersAsOptionals3<TYPE[K], UnprefixPathExtractFirstProperty<MANDATORY_AT_LEVEL, K>, InMandatory<K, MANDATORY_AT_LEVEL, MANDATORY_PARENT>>
    }
>

type PickWitOthersAsOptionals3<TYPE, MANDATORY_AT_LEVEL extends string, MANDATORY_PARENT> = Expand<{ 
        [K in MadatoriyValuesKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: TYPE[K] 
    } & {
        [K in MandatoryNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: 
            PickWitOthersAsOptionals4<TYPE[K], UnprefixPathExtractFirstProperty<MANDATORY_AT_LEVEL, K>, InMandatory<K, MANDATORY_AT_LEVEL, MANDATORY_PARENT>>
    } & {
        [K in OptionalValueKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]?: TYPE[K]
    } & {
        [K in OptionalNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]?: 
            PickWitOthersAsOptionals4<TYPE[K], UnprefixPathExtractFirstProperty<MANDATORY_AT_LEVEL, K>, InMandatory<K, MANDATORY_AT_LEVEL, MANDATORY_PARENT>>
    }
>

type PickWitOthersAsOptionals4<TYPE, MANDATORY_AT_LEVEL extends string, MANDATORY_PARENT> = Expand<{ 
        [K in MadatoriyValuesKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: TYPE[K] 
    } & {
        [K in MandatoryNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: 
            PickWitOthersAsOptionals5<TYPE[K], UnprefixPathExtractFirstProperty<MANDATORY_AT_LEVEL, K>, InMandatory<K, MANDATORY_AT_LEVEL, MANDATORY_PARENT>>
    } & {
        [K in OptionalValueKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]?: TYPE[K]
    } & {
        [K in OptionalNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]?: 
            PickWitOthersAsOptionals5<TYPE[K], UnprefixPathExtractFirstProperty<MANDATORY_AT_LEVEL, K>, InMandatory<K, MANDATORY_AT_LEVEL, MANDATORY_PARENT>>
    }
>

type PickWitOthersAsOptionals5<TYPE, MANDATORY_AT_LEVEL extends string, MANDATORY_PARENT> = Expand<{ 
        [K in MadatoriyValuesKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: TYPE[K] 
    } & {
        [K in MandatoryNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: TYPE[K]
    } & {
        [K in OptionalValueKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]?: TYPE[K]
    } & {
        [K in OptionalNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]?: TYPE[K]
    }
>

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
 * Create a object where all non-mandatories properties are removed,
 * keeping in mind that only apply for the innnermost elements
 * 
 * ExtractFirstProperty is used to avoid required objects where all inside
 * is optional
 */

export type PickMandatoryOnly<TYPE, MANDATORY extends string> = PickMandatoryOnly1<TYPE, MANDATORY | ExtractFirstPropertyInPath<MANDATORY>, false>

type PickMandatoryOnly1<TYPE, MANDATORY_AT_LEVEL extends string, MANDATORY_PARENT> = Expand<{ 
        [K in MadatoriyValuesKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: TYPE[K] 
    } & {
        [K in MandatoryNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: 
            PickMandatoryOnly2<TYPE[K], UnprefixPathExtractFirstProperty<MANDATORY_AT_LEVEL, K>, InMandatory<K, MANDATORY_AT_LEVEL, MANDATORY_PARENT>>
    }
>

type PickMandatoryOnly2<TYPE, MANDATORY_AT_LEVEL extends string, MANDATORY_PARENT> = Expand<{ 
        [K in MadatoriyValuesKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: TYPE[K] 
    } & {
        [K in MandatoryNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: 
            PickMandatoryOnly3<TYPE[K], UnprefixPathExtractFirstProperty<MANDATORY_AT_LEVEL, K>, InMandatory<K, MANDATORY_AT_LEVEL, MANDATORY_PARENT>>
    }
>

type PickMandatoryOnly3<TYPE, MANDATORY_AT_LEVEL extends string, MANDATORY_PARENT> = Expand<{ 
        [K in MadatoriyValuesKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: TYPE[K] 
    } & {
        [K in MandatoryNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: 
            PickMandatoryOnly4<TYPE[K], UnprefixPathExtractFirstProperty<MANDATORY_AT_LEVEL, K>, InMandatory<K, MANDATORY_AT_LEVEL, MANDATORY_PARENT>>
    }
>

type PickMandatoryOnly4<TYPE, MANDATORY_AT_LEVEL extends string, MANDATORY_PARENT> = Expand<{ 
        [K in MadatoriyValuesKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: TYPE[K] 
    } & {
        [K in MandatoryNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: 
            PickMandatoryOnly5<TYPE[K], UnprefixPathExtractFirstProperty<MANDATORY_AT_LEVEL, K>, InMandatory<K, MANDATORY_AT_LEVEL, MANDATORY_PARENT>>
    }
>

type PickMandatoryOnly5<TYPE, MANDATORY_AT_LEVEL extends string, MANDATORY_PARENT> = Expand<{ 
        [K in MadatoriyValuesKeysForPickResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: TYPE[K] 
    } & {
        [K in MandatoryNonValueKeysForResult<TYPE, MANDATORY_AT_LEVEL, MANDATORY_PARENT>]: TYPE[K]
    }
>

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type MadatoriyValuesKeysForPickResult<TYPE, MANDATORY extends string, MANDATORY_PARENT> =
    { [K in UsableKeyOf<TYPE>]-?: 
        TYPE[K] extends AnyValueSource | undefined ? (
            MANDATORY_PARENT extends true ? K : K extends MANDATORY ? K : never
        ) : never // Not AnyValueSource
    }[UsableKeyOf<TYPE>]

type OptionalValueKeysForPickResult<TYPE, MANDATORY extends string, MANDATORY_PARENT> =
    { [K in UsableKeyOf<TYPE>]-?: 
        TYPE[K] extends AnyValueSource | undefined ? (
            MANDATORY_PARENT extends true ? never : K extends MANDATORY ? never : K
        ) : never // Not AnyValueSource
    } [UsableKeyOf<TYPE>]

type MandatoryNonValueKeysForResult<TYPE, MANDATORY extends string, MANDATORY_PARENT> =
    { [K in UsableKeyOf<TYPE>]-?: 
        TYPE[K] extends AnyValueSource | undefined ? never 
        : MANDATORY_PARENT extends true ? K : K extends MANDATORY ? K: never
    } [UsableKeyOf<TYPE>]

type OptionalNonValueKeysForResult<TYPE, MANDATORY extends string, MANDATORY_PARENT> =
    { [K in UsableKeyOf<TYPE>]-?: 
        TYPE[K] extends AnyValueSource | undefined ? never 
        : MANDATORY_PARENT extends true ? never : K extends MANDATORY ? never : K
    } [UsableKeyOf<TYPE>]

type InMandatory<K, MANDATORY, MANDATORY_PARENT> = K extends MANDATORY ? true : MANDATORY_PARENT
