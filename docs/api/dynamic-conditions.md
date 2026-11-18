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

The utility type `DynamicCondition`, from `ts-sql-query`, is the type of the dynamic criteria. It receives a map with the name of each field, and as value the name of its type (a built-in one, or one of yours [registered](../advanced/data-types/own-data-types.md#giving-your-type-by-its-name), like `'Money'`), its data type (the class of a type of yours, like `MoneyType`), a value source to get the type from, or a nested map. [Dynamic conditions](../dynamic/helper-types/conditions.md) shows how to use it and the other helper types.

For the filter definition:

```typescript
type FilterType = DynamicCondition<{
    myBoolean: 'boolean'
    myInt: 'int'
    myBigint: 'bigint'
    myDouble: 'double'
    myString: 'string'
    myUuid: 'uuid'
    myStringDecimal: 'stringDecimal'
    myLocalDate: 'localDate'
    myLocalTime: 'localTime'
    myLocalDateTime: 'localDateTime'
    myEnum: MyEnumType
    myEqualable: MyEqualableType
    myComparable: MyComparableType
    myNumber: MyNumberType
    myOwnUuid: MyUuidType
    myOwnDate: MyDateType
}>
```

Where `MyEnumType` is a class of yours that extends `EnumType<MyEnum, 'MyEnum'>`, `MyEqualableType` one that extends `EqualableType`, `MyComparableType` one that extends `ComparableType`, `MyNumberType` one of the families of the numbers, like `IntegersType` or `RealsType`, `MyUuidType` one that extends `UuidsType`, and `MyDateType` one of the families of the dates, like `LocalDatesType` (see [Your own types](../advanced/data-types/own-data-types.md#the-families)).

The `FilterType` definition looks like this. Every field is optional, and `FilterOf<DataType>`, exported from `ts-sql-query`, is the filter of a field of that data type:

```tsx
type FilterType = {
    not?: FilterType
    and?: ReadonlyArray<FilterType | undefined>
    or?: ReadonlyArray<FilterType | undefined>
    myBoolean?: FilterOf<BooleanType>
    myInt?: FilterOf<IntType>
    myBigint?: FilterOf<BigintType>
    myDouble?: FilterOf<DoubleType>
    myString?: FilterOf<StringType>
    myUuid?: FilterOf<UuidType>
    myStringDecimal?: FilterOf<StringDecimalType>
    myLocalDate?: FilterOf<LocalDateType>
    myLocalTime?: FilterOf<LocalTimeType>
    myLocalDateTime?: FilterOf<LocalDateTimeType>
    myEnum?: FilterOf<MyEnumType>
    myEqualable?: FilterOf<MyEqualableType>
    myComparable?: FilterOf<MyComparableType>
    myNumber?: FilterOf<MyNumberType>
    myOwnUuid?: FilterOf<MyUuidType>
    myOwnDate?: FilterOf<MyDateType>
}
```

!!! note

    A `uuid` and a uuid of yours (a class that extends `UuidsType`) have the text operators of a `string`, with a `string`: they apply to the text of the uuid, as its methods with the same names do.

!!! tip "Deriving the filter type from a business model"

    `DynamicConditionForModel<Model>` derives the filter type from an interface of yours, with no value source in your public signatures. See [`DynamicConditionForModel`](../dynamic/helper-types/conditions.md#dynamicconditionformodel), and [Typing dynamic queries from a business model](../dynamic/own-function/from-business-model.md) for the model-to-filter mapping and its limitations.

You can use the properties `and`, `or` and `not` to perform the logical operations. If you specify several properties in a filter, all of them are joined using the `and` operator. The same happens with the elements of the **`and`** array. Elements of the **`or`** array are joined using the `or` operator.

`FilterOf` has an optional property for each operation the data type exposes to a filter, with the value its method takes (see [Operations of your own in a dynamic filter](../advanced/data-types/methods-of-your-own.md#operations-of-your-own-in-a-dynamic-filter)). For a data type whose values are of type `TYPE`, these are the operators, by what its values can do.

Equality, of every data type but an aggregated array:

```tsx
{
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
    inIfValue?: readonly TYPE[] | null | undefined
    in?: readonly TYPE[]
    notInIfValue?: readonly TYPE[] | null | undefined
    notIn?: readonly TYPE[]
}
```

Also comparison (the numbers, the dates, the texts, the uuids, and a class that extends `ComparableType` or one of the families of the numbers or of the dates):

```tsx
{
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

Also the text operators (`'string'`, and, applied to their text, `'uuid'` and a class that extends `UuidsType`), always with a `string`:

```tsx
{
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

An aggregated array has no operators.

To offer methods of your own in a filter, a class of yours lists them with `exposeFilterOperations`, exported from `ts-sql-query` with the symbol `filterOperation`:

```tsx
function exposeFilterOperations(dataType: Class, family: FamilyClass | undefined, names: readonly MethodName[], aliases?: { [alias: string]: Name }): (operation: Names) => string | undefined
```

It's called in the static `[filterOperation]` of the class, which the instance declares (`declare [filterOperation]: (typeof MyType)[typeof filterOperation]`). `family` is the class it extends, whose operations and aliases it keeps, each name is a method of the class that gives a condition and has no parameters or one required parameter, and `aliases` gives other names a filter can use for them, which only `withValues` accepts: the types of the filter don't have them. The function it returns gives the method a name of a filter calls, or `undefined` when the class doesn't expose it.

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
