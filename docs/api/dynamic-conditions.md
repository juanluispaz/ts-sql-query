---
search:
  boost: 0.3
---
# Dynamic conditions API

This page describes the API for building dynamic conditions in `ts-sql-query`, enabling you to construct queries at runtime in a type-safe and declarative way. It covers how to define filter types, use logical combinations, and extend the filtering capabilities with custom rules.

!!! tip

    See [Select using a dynamic filter](../dynamic/caller-decides/filters.md) for related information.

These types are strict, and the execution is tolerant: in a filter that arrives as data, an operator with an empty value (`null`, an empty string, an empty array) adds no condition. See [Empty values in a filter](../dynamic/caller-decides/filters.md#empty-values-in-a-filter).

A dynamic condition allows you to create a condition whose structure is defined at runtime. To create a dynamic condition, you must call the method `dynamicConditionFor` from the connection. This method receives a map where the key is the name with which is going to be referred the field, and the value is the corresponding value source to be used in the query. The `dynamicConditionFor` method returns an object that contains the method `withValues` that receives the dynamic criteria and returns a boolean value source that you can use in any place where a boolean can be used in the query (like the where).

```typescriptreact
const dynamicCondition = connection.dynamicConditionFor(selectFields).withValues(filter)
```

The utility type `DynamicCondition`, from `ts-sql-query` or `ts-sql-query/dynamic/condition`, is the type of the dynamic criteria. It receives a map with the name of each field, and as value the name of its type, a value source to get the type from, or a nested map. [Dynamic conditions](../dynamic/helper-types/conditions.md) shows how to use it and the other helper types.

For the filter definition:

```typescript
type FilterType = DynamicCondition<{
    myBoolean: 'boolean'
    myInt: 'int'
    myBigint: 'bigint'
    myDouble: 'double'
    myString: 'string'
    myUuid: 'uuid'
    myLocalDate: 'localDate'
    myLocalTime: 'localTime'
    myLocalDateTime: 'localDateTime'
    myEnum: ['enum', MyEnumType]
    myCustom: ['custom', MyCustomType]
    myCustomComparable: ['customComparable', MyCustomComparableType]
    myCustomInt: ['customInt', MyCustomType]
    myCustomDouble: ['customDouble', MyCustomType]
    myCustomUuid: ['customUuid', MyCustomType]
    myCustomLocalDate: ['customLocalDate', MyCustomType]
    myCustomLocalTime: ['customLocalTime', MyCustomType]
    myCustomLocalDateTime: ['customLocalDateTime', MyCustomType]
}>
```

The `FilterType` definition looks like this. Every field is optional:

```tsx
type FilterType = {
    not?: FilterType
    and?: Array<FilterType | undefined>
    or?: Array<FilterType | undefined>
    myBoolean?: BooleanFilter
    myInt?: NumberFilter
    myBigint?: BigintFilter
    myDouble?: NumberFilter
    myString?: StringFilter
    myUuid?: StringFilter
    myLocalDate?: DateFilter
    myLocalTime?: TimeFilter
    myLocalDateTime?: DateTimeFilter
    myEnum?: EqualableFilter<MyEnumType>
    myCustom?: EqualableFilter<MyCustomType>
    myCustomComparable?: ComparableFilter<MyCustomComparableType>
    myCustomInt?: CustomIntFilter<MyCustomType>
    myCustomDouble?: CustomDoubleFilter<MyCustomType>
    myCustomUuid?: CustomUuidFilter<MyCustomType>
    myCustomLocalDate?: CustomLocalDateFilter<MyCustomType>
    myCustomLocalTime?: CustomLocalTimeFilter<MyCustomType>
    myCustomLocalDateTime?: CustomLocalDateTimeFilter<MyCustomType>
}
```

!!! note

    For convenience, the `uuid` and `customUuid` types accept the text operators of `StringFilter`, and they apply the `asString()` method before them.

!!! tip "Deriving the filter type from a business model"

    `DynamicConditionForModel<Model>` derives the filter type from an interface of yours, with no value source in your public signatures. See [`DynamicConditionForModel`](../dynamic/helper-types/conditions.md#dynamicconditionformodel), and [Typing dynamic queries from a business model](../dynamic/own-function/from-business-model.md) for the model-to-filter mapping and its limitations.

You can use the properties `and`, `or` and `not` to perform the logical operations. If you specify several properties in a filter, all of them are joined using the `and` operator. The same happens with the elements of the **`and`** array. Elements of the **`or`** array are joined using the `or` operator.

The definitions of the filters of each field are:

```typescript
interface NullableFilter {
    isNull?: boolean
    isNotNull?: boolean
}
```

```typescript
interface EqualableFilter<TYPE> extends NullableFilter {
    equalsIfValue?: TYPE | null | undefined
    equals?: TYPE
    notEqualsIfValue?: TYPE | null | undefined
    notEquals?: TYPE
    isIfValue?: TYPE | null | undefined
    is?: TYPE | null | undefined
    isNotIfValue?: TYPE | null | undefined
    isNot?: TYPE | null | undefined
    inIfValue?: TYPE[] | null | undefined
    in?: TYPE[]
    notInIfValue?: TYPE[] | null | undefined
    notIn?: TYPE[]
}
```

```typescript
interface ComparableFilter<TYPE> extends EqualableFilter<TYPE> {
    lessThanIfValue?: TYPE | null | undefined
    lessThan?: TYPE
    greaterThanIfValue?: TYPE | null | undefined
    greaterThan?: TYPE
    lessOrEqualIfValue?: TYPE | null | undefined
    lessOrEqual?: TYPE
    greaterOrEqualIfValue?: TYPE | null | undefined
    greaterOrEqual?: TYPE
}
```

```typescript
interface StringFilter extends ComparableFilter<string> {
    equalsInsensitiveIfValue?: string | null | undefined
    equalsInsensitive?: string
    notEqualsInsensitiveIfValue?: string | null | undefined
    notEqualsInsensitive?: string
    likeIfValue?: string | null | undefined
    like?: string
    notLikeIfValue?: string | null | undefined
    notLike?: string
    likeInsensitiveIfValue?: string | null | undefined
    likeInsensitive?: string
    notLikeInsensitiveIfValue?: string | null | undefined
    notLikeInsensitive?: string
    startsWithIfValue?: string | null | undefined
    startsWith?: string
    notStartsWithIfValue?: string | null | undefined
    notStartsWith?: string
    endsWithIfValue?: string | null | undefined
    endsWith?: string
    notEndsWithIfValue?: string | null | undefined
    notEndsWith?: string
    startsWithInsensitiveIfValue?: string | null | undefined
    startsWithInsensitive?: string
    notStartsWithInsensitiveIfValue?: string | null | undefined
    notStartsWithInsensitive?: string
    endsWithInsensitiveIfValue?: string | null | undefined
    endsWithInsensitive?: string
    notEndsWithInsensitiveIfValue?: string | null | undefined
    notEndsWithInsensitive?: string
    containsIfValue?: string | null | undefined
    contains?: string
    notContainsIfValue?: string | null | undefined
    notContains?: string
    containsInsensitiveIfValue?: string | null | undefined
    containsInsensitive?: string
    notContainsInsensitiveIfValue?: string | null | undefined
    notContainsInsensitive?: string
}
```

```typescript
interface CustomUuidFilter<TYPE> extends ComparableFilter<TYPE> {
    equalsInsensitiveIfValue?: TYPE | null | undefined
    equalsInsensitive?: TYPE
    notEqualsInsensitiveIfValue?: TYPE | null | undefined
    notEqualsInsensitive?: TYPE
    likeIfValue?: TYPE | null | undefined
    like?: TYPE
    notLikeIfValue?: TYPE | null | undefined
    notLike?: TYPE
    likeInsensitiveIfValue?: TYPE | null | undefined
    likeInsensitive?: TYPE
    notLikeInsensitiveIfValue?: TYPE | null | undefined
    notLikeInsensitive?: TYPE
    startsWithIfValue?: TYPE | null | undefined
    startsWith?: TYPE
    notStartsWithIfValue?: TYPE | null | undefined
    notStartsWith?: TYPE
    endsWithIfValue?: TYPE | null | undefined
    endsWith?: TYPE
    notEndsWithIfValue?: TYPE | null | undefined
    notEndsWith?: TYPE
    startsWithInsensitiveIfValue?: TYPE | null | undefined
    startsWithInsensitive?: TYPE
    notStartsWithInsensitiveIfValue?: TYPE | null | undefined
    notStartsWithInsensitive?: TYPE
    endsWithInsensitiveIfValue?: TYPE | null | undefined
    endsWithInsensitive?: TYPE
    notEndsWithInsensitiveIfValue?: TYPE | null | undefined
    notEndsWithInsensitive?: TYPE
    containsIfValue?: TYPE | null | undefined
    contains?: TYPE
    notContainsIfValue?: TYPE | null | undefined
    notContains?: TYPE
    containsInsensitiveIfValue?: TYPE | null | undefined
    containsInsensitive?: TYPE
    notContainsInsensitiveIfValue?: TYPE | null | undefined
    notContainsInsensitive?: TYPE
}
```

```typescript
interface BooleanFilter extends EqualableFilter<boolean> { }
interface NumberFilter extends ComparableFilter<number> { }
interface BigintFilter extends ComparableFilter<bigint> { }
interface DateFilter extends ComparableFilter<Date> { }
interface TimeFilter extends ComparableFilter<Date> { }
interface DateTimeFilter extends ComparableFilter<Date> { }
interface CustomIntFilter<TYPE> extends ComparableFilter<TYPE> { }
interface CustomDoubleFilter<TYPE> extends ComparableFilter<TYPE> { }
interface CustomLocalDateFilter<TYPE> extends ComparableFilter<TYPE> { }
interface CustomLocalTimeFilter<TYPE> extends ComparableFilter<TYPE> { }
interface CustomLocalDateTimeFilter<TYPE> extends ComparableFilter<TYPE> { }
```

You can extend the set of rules defining your own. For this, you will need to construct an object (it can contain inner objects), where the key is the name of the rule, and the value is a function that receives as an argument the configuration of the rule, and it must return a boolean value source. When you create the dynamic condition, you must provide the extension as the second argument. `withValues` accepts the rules in the filter, written in place or in a variable. If you use the `DynamicCondition` utility type, you must provide the type of your extension object as a second argument. See [Rules of your own](../dynamic/caller-decides/filters.md#rules-of-your-own).

```typescriptreact
const extension = {
    myCondition: (value: string /* your custom rule input */) => {
        // return a BooleanValueSource based on the value
        // ...
    },
    myGroup: {
        myGroupCondition: (value: number /* it can be your own type*/) => { 
            // return a BooleanValueSource based on the value
            // ... 
        }
    }
}
const dynamicCondition = connection.dynamicConditionFor(selectFields, extension).withValues(filter)
```
