---
search:
  boost: 0.7
---
# Dynamic conditions

A dynamic filter is a condition that arrives as data, and [Dynamic filters](../caller-decides/filters.md) explains how it works. This page is the reference of these types, exported from `ts-sql-query`. They describe the object that `connection.dynamicConditionFor(fields).withValues(filter)` receives. They exist only for TypeScript and don't change the query.

| Type | What it's for | Where it's used |
|---|---|---|
| [`DynamicCondition<Definition, Extension?>`](#dynamiccondition) | The type of a filter, from a map of columns or of type names | [Dynamic filters](../caller-decides/filters.md), [Typing from the database types](../own-function/from-database-types.md) |
| [`FilterOf<DataType>`](#the-filter-of-each-field) | The operators of one field | The type of a value inside a filter, when your code builds it in parts |
| [`DynamicConditionForModel<Model, Extension?>`](#dynamicconditionformodel) | The type of a filter, from an interface of yours | [Typing from a business model](../own-function/from-business-model.md) |
| [`DynamicDefinitionForModel<Model>`](#dynamicdefinitionformodel) | The map of type names of an interface | Adding fields to a model before building a `DynamicCondition` |

## DynamicCondition

`DynamicCondition<Definition, Extension?>` is the type of a filter. `Definition` has one key for each field the filter can use, and each value can be the name of a type, a column or expression, or a nested object of them.

```ts
import { DynamicCondition } from "ts-sql-query"

type CustomerFilter = DynamicCondition<{
    id: 'int'
    firstName: 'string'
    birthday: 'localDate'
    company: {
        name: 'string'
    }
}>

const filter: CustomerFilter = {
    firstName: { startsWithInsensitive: 'John' },
    company: { name: { equals: 'ACME' } }
}

const selectFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    birthday: tCustomer.birthday,
    company: {
        name: tCompany.name
    }
}

const customers = await connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .where(connection.dynamicConditionFor(selectFields).withValues(filter))
    .select(selectFields)
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.birthday as birthday, 
        company.name as `company.name` 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            lower(customer.first_name) like concat(lower(?), '%') 
        and company.name = ?
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.birthday as birthday, 
        company.name as `company.name` 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            lower(customer.first_name) like concat(lower(?), '%') 
        and company.name = ?
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "firstName", 
        customer.birthday as "birthday", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            lower(customer.first_name) like lower(:0 || '%') escape '\' 
        and company.name = :1
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "firstName", 
        customer.birthday as birthday, 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            customer.first_name ilike ($1 || '%') 
        and company.name = $2
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.birthday as birthday, 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            lower(customer.first_name) like lower(?1 || '%') escape '\' 
        and company.name = ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.birthday as birthday, 
        company.name as [company.name] 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            lower(customer.first_name) like lower(@0 + '%') 
        and company.name = @1
    ```

The parameters are: `[ 'John', 'ACME' ]`

The names of the types exist only in the type: `dynamicConditionFor` still receives the columns. To avoid writing the fields twice, build the type from the map of columns, with `DynamicCondition<typeof selectFields>`. The type of each column then appears in the signatures that use the filter. If you want to keep that out, use [`DynamicConditionForModel`](#dynamicconditionformodel).

Besides its fields, a filter has `and` and `or`, which receive an array of filters, and `not`, which receives a filter. [Dynamic filters](../caller-decides/filters.md) shows what each one produces.

`Extension` is the type of the [rules of your own](../caller-decides/filters.md#rules-of-your-own), the second argument of `dynamicConditionFor`. The usual way to write it is `ReturnType` of the function that builds them, as in [a function that returns a dynamic select](../own-function/dynamic-select-functions.md#from-the-database).

## The filter of each field

The value of a field in a filter is an object with the operators of its data type. `FilterOf<DataType>`, exported from `ts-sql-query`, is its type, with the class of the data type, like `FilterOf<StringType>`, so your code can use it when it builds a filter in parts:

```ts
import { DynamicCondition, FilterOf, StringType } from "ts-sql-query"

type CustomerFilter = DynamicCondition<{
    firstName: 'string'
    lastName: 'string'
}>

function textFilter(text: string): FilterOf<StringType> {
    return { containsInsensitive: text }
}

const filter: CustomerFilter = {
    or: [
        { firstName: textFilter('smi') },
        { lastName: textFilter('smi') }
    ]
}

const selectFields = {
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName
}

const customers = await connection.selectFrom(tCustomer)
    .where(connection.dynamicConditionFor(selectFields).withValues(filter))
    .select(selectFields)
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like concat('%', lower(?), '%') 
        or lower(last_name) like concat('%', lower(?), '%')
    ```
=== "MySQL"
    ```mysql
    select 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like concat('%', lower(?), '%') 
        or lower(last_name) like concat('%', lower(?), '%')
    ```
=== "Oracle"
    ```oracle
    select 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where 
           lower(first_name) like lower('%' || :0 || '%') escape '\' 
        or lower(last_name) like lower('%' || :1 || '%') escape '\'
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where 
           first_name ilike ('%' || $1 || '%') 
        or last_name ilike ('%' || $2 || '%')
    ```
=== "SQLite"
    ```sqlite
    select 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like lower('%' || ?1 || '%') escape '\' 
        or lower(last_name) like lower('%' || ?2 || '%') escape '\'
    ```
=== "SQL Server"
    ```sqlserver
    select 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like lower('%' + @0 + '%') 
        or lower(last_name) like lower('%' + @1 + '%')
    ```

The parameters are: `[ 'smi', 'smi' ]`

Each operator of a filter is a method of the data type of the field, which the filter calls with the value given: `{ firstName: { containsInsensitive: 'smi' } }` is `firstName.containsInsensitive('smi')`. This table has the operators of each data type: a built-in one, given in the definition by its name, or a class of yours, given as the class (`total: MoneyType`) or, once [registered](../../advanced/data-types/own-data-types.md#giving-your-type-by-its-name), as its type name (`total: 'Money'`). A column or expression in the map gets the filter of its data type in the same way.

| Type in the definition | Its filter | Operators |
|---|---|---|
| `'boolean'` | `FilterOf<BooleanType>` | Equality |
| `'int'`, `'double'` | `FilterOf<IntType>`, `FilterOf<DoubleType>` | Equality and comparison, with a `number` |
| `'bigint'` | `FilterOf<BigintType>` | Equality and comparison, with a `bigint` |
| `'stringDecimal'` | `FilterOf<StringDecimalType>` | Equality and comparison, with a `string` |
| `'string'` | `FilterOf<StringType>` | Equality, comparison and the text operators |
| `'uuid'` | `FilterOf<UuidType>` | Equality, comparison and the text operators, applied to its text |
| `'localDate'`, `'localTime'`, `'localDateTime'` | `FilterOf<LocalDateType>`, `FilterOf<LocalTimeType>`, `FilterOf<LocalDateTimeType>` | Equality and comparison, with a `Date` |
| A class that extends `EnumType` or `EqualableType` | `FilterOf<YourType>` | Equality, with values of your type |
| A class that extends `ComparableType`, one of the families of the numbers (`IntegersType`, `DecimalsType`, `RealsType`, `AdditiveType`, `MultipliableType`, `DivisibleType`) or of the dates (`LocalDatesType`, `LocalTimesType`, `LocalDateTimesType`) | `FilterOf<YourType>` | Equality and comparison, with values of your type |
| A class that extends `UuidsType` | `FilterOf<YourType>` | Equality and comparison, with values of your type, and the text operators, with a `string`, applied to its text |
| An aggregated array | None | None |

The operators of each group are:

- Equality: `isNull` and `isNotNull`, which take `true` (the condition) or `false` (its negation), and `equals`, `notEquals`, `is`, `isNot`, `in` and `notIn`.
- Comparison: `lessThan`, `greaterThan`, `lessOrEqual` and `greaterOrEqual`.
- The text operators: `equalsInsensitive`, `notEqualsInsensitive`, and `like`, `startsWith`, `endsWith` and `contains`, each of these four with its `not` and `Insensitive` forms, like `notLike`, `likeInsensitive` and `notLikeInsensitive`.

Every operator except `isNull` and `isNotNull` has a twin ending in `IfValue`, like `equalsIfValue`, whose type also accepts `null` and `undefined`. See [Empty values in a filter](../caller-decides/filters.md#empty-values-in-a-filter) for what happens with them.

A class of yours can add operators of its own: see [Operations of your own in a dynamic filter](../../advanced/data-types/methods-of-your-own.md#operations-of-your-own-in-a-dynamic-filter). The [Dynamic conditions API](../../api/dynamic-conditions.md) lists the type of the value of each operator.

## DynamicConditionForModel

`DynamicConditionForModel<Model, Extension?>` builds the type of a filter from an interface of yours, so the signatures of your functions don't mention the columns. It's the same as `DynamicCondition<DynamicDefinitionForModel<Model>, Extension>`, and it's received by `withValues` in the same way. A complete function is in [Typing from a business model](../own-function/from-business-model.md#filtering-dynamicconditionformodel).

| Type of the property | Name of the type | Filter |
|---|---|---|
| `boolean` | `'boolean'` | `FilterOf<BooleanType>` |
| `number` | `'int'` | `FilterOf<IntType>` |
| `bigint` | `'bigint'` | `FilterOf<BigintType>` |
| `string` | `'string'` | `FilterOf<StringType>` |
| `Date` | `'localDateTime'` | `FilterOf<LocalDateTimeType>`, with the same operators as the other dates |
| A union of texts or numbers, like `'active' \| 'inactive'` | `EnumType<T, string>` | `FilterOf<EnumType<T, string>>` |
| A nested object | A nested definition | A nested filter |

A property can be optional or nullable: the filter is the same.

```ts
import { DynamicConditionForModel, DynamicDefinitionForModel } from "ts-sql-query"

interface Customer {
    id: number
    name: string
    birthday: Date
    vip: boolean
    status: 'active' | 'inactive'
    company?: {
        id: number
        name: string
    }
}

// the filter type derived from the model
type CustomerFilter = DynamicConditionForModel<Customer>

// the descriptor map it builds on
type CustomerDefinition = DynamicDefinitionForModel<Customer>

// a criteria object, fully checked against the model
const filter: CustomerFilter = {
    name: { containsInsensitive: 'ACME' },
    vip: { equals: true },
    status: { in: ['active'] },
    birthday: { greaterThan: new Date('1990-01-01') },
    company: { name: { equals: 'ACME Corp' } }
}
```

An interface has only TypeScript types, so it doesn't say how the column is defined. Two cases need a definition with the names of the types instead of a model:

- A column of a [type of yours](../../advanced/data-types/own-data-types.md): the filter depends on the TypeScript type alone. If the property is a `string`, it gets `FilterOf<StringType>`. If it's a type made more specific, like `string & { __brand: 'code' }`, it can be any type of yours, so it gets the filter of a `ComparableType` of that type, `FilterOf<ComparableType<Code, string>>`.
- A property that is an array, a `Map`, a `Set` or a binary value: it has no filter, and it doesn't appear in the type.

[Rules of your own](../caller-decides/filters.md#rules-of-your-own) go in the second type argument, as in `DynamicCondition`.

## DynamicDefinitionForModel

`DynamicDefinitionForModel<Model>` is the definition that `DynamicConditionForModel` builds from the interface, following the table above. It's exported to add fields that aren't in the interface, like one that only the filter uses:

```ts
import { DynamicCondition, DynamicDefinitionForModel } from "ts-sql-query"

interface Customer {
    id: number
    name: string
    company?: {
        id: number
        name: string
    }
}

// compose the model-derived descriptor with hand-written descriptor fields
type AuditedFilter = DynamicCondition<DynamicDefinitionForModel<Customer> & { auditedAt: 'localDateTime' }>
```

## See also

- [Dynamic filters](../caller-decides/filters.md): how a filter works, what each operator produces, and what happens with a filter that is wrong.
- [Dynamic conditions API](../../api/dynamic-conditions.md): the definition of the filter types.
- [Typing from a business model](../own-function/from-business-model.md) and [Typing from the database types](../own-function/from-database-types.md): complete functions with these types.
