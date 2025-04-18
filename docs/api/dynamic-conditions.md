---
search:
  boost: 0.3
---
# Dynamic conditions API

See [Select using a dynamic filter](../queries/extreme-dynamic-queries.md#select-using-a-dynamic-filter) for more information.

A dynamic condition allows you to create a condition which definition is provided in runtime. To create a dynamic condition, you must call the method `dynamicConditionFor` from the connection; this method receives a map where the key is the name with which is going to be referred the field, and the value is the corresponding value source to be used in the query. The `dynamicConditionFor` method returns an object that contains the method `withValues` that receives the dynamic criteria and returns a boolean value source that you can use in any place where a boolean can be used in the query (like the where).

```ts
const dynamicCondition = connection.dynamicConditionFor(selectFields).withValues(filter)
```

The utility type `DynamicCondition` from `ts-sql-query/dynamicCondition` allows you to create a type definition for the dynamic criteria. This object receives a map with the name for the field and as value the name of the type or the value source to extract the type.


For the filter definition:

```ts
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
}>
```

The `FilterType` definition looks like this:

```ts
type FilterType = {
    not?: FilterType
    and?: Array<FilterType | undefined>
    or?: Array<FilterType | undefined>
    myBoolean: EqualableFilter<boolean>
    myInt: ComparableFilter<number>
    myBigint: ComparableFilter<bigint>
    myDouble: ComparableFilter<number>
    myString: StringFilter
    myString: StringFilter
    myLocalDate: ComparableFilter<Date>
    myLocalTime: ComparableFilter<Date>
    myLocalDateTime: ComparableFilter<Date>
    myEnum: EqualableFilter<MyEnumType>
    myCustom: EqualableFilter<MyCustomType>
    myCustomComparable: ComparableFilter<MyCustomComparableType>
}

```

!!! note

    For convenience, `uuid` type will be treated as string type, calling `asString()` method automatically in all methods defined in the `StringFilter` interface.

You can use the properties `and`, `or` and `not` to perform the logical operations. If you specify multiple elements to the `FilterType`, all of them will be joined using the and operator. The same happens with the elements specified in the `and` array. But the elements will be joined using the or operator in the case of the `or` array.

The definition of the different types are:

```ts
interface EqualableFilter<TYPE> {
    isNull?: boolean
    isNotNull?: boolean
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

interface ComparableFilter<TYPE> extends EqualableFilter<TYPE> {
    lessThanIfValue?: TYPE | null | undefined
    lessThan?: TYPE
    greaterThanIfValue?: TYPE | null | undefined
    greaterThan?: TYPE
    lessOrEqualsIfValue?: TYPE | null | undefined
    lessOrEquals?: TYPE
    greaterOrEqualsIfValue?: TYPE | null | undefined
    greaterOrEquals?: TYPE
}

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

You can extend the set of rules defining your own. For this, you will need to construct an object (it can contain inner objects), where the key is the name of the rule, and the value is a function that receives as an argument the configuration of the rule, and it must return a boolean value source. When you create the dynamic condition, you must provide the extension as the second argument; if you use the `DynamicCondition` utility type, you must provide the type of your extension object as a second argument.

```ts
const extension {
    myCondition: (value: string /* it can be your own type*/) => { ... }
    myGroup: {
        myGroupCondition: (value: number /* it can be your own type*/) => { ... }
    }
}
const dynamicCondition = connection.dynamicConditionFor(selectFields).withValues(filter, extentsion)
```
