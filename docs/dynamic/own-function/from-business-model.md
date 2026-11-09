---
search:
  boost: 1.5
---
# Typing dynamic queries from a business model

A function that serves many callers receives a filter, the columns to return and an order. Its parameters need types, so that the compiler checks each call and the result has only the columns that were asked for. These types can come from two places: from [the columns of the query](from-database-types.md), or from an interface you write. This page takes them from the interface, your business model, so the signature of the function mentions that interface and no table or column.

The function still builds a map of its columns, usually called `availableFields`, because the SQL comes from it. The map stays inside the function.

| What goes through the function | Its type | What uses it inside the function |
|---|---|---|
| The filter | `DynamicConditionForModel<Model>` | `connection.dynamicConditionFor(availableFields).withValues(filter)` |
| The columns to return | `DeepPickPaths<Model>[]` | `dynamicPickPaths(availableFields, fields, ['id'])` |
| The order | `OrderByForModel<Model>[]` | `.orderByFromStringArrayIfValue(orderBy)` |
| The rows returned | `DeepPick<Model, FIELDS>[]` | `expandTypeFromDynamicPickPaths(availableFields, fields, rows, ['id'])` |

The types and the functions can be imported from the root `ts-sql-query`, or from `ts-sql-query/dynamic/condition`, `ts-sql-query/dynamic/pick`, `ts-sql-query/dynamic/orderBy` and `ts-sql-query/extras/deepUtilities`. Each section below is a complete function you can copy, and the last one has the three together.

## What an interface costs

These are only types: the SQL is built from the map and from the values received, so it's the same SQL as [from the columns](from-database-types.md#from-the-columns-or-from-an-interface), where the two ways are compared. Here the cost is the interface: you write it, and you keep it in step with the map.

The compiler helps with that. The rows have to fit the interface when the function returns them, the filter has to fit the map in `withValues`, and the paths have to exist in the map in `dynamicPickPaths`. What it can miss is an optional property of the interface that isn't in the map, in a function that doesn't pick columns: it compiles, and a call that uses it in the filter or the order throws `DYNAMIC_CONDITION_UNKNOWN_COLUMN` or `ORDER_BY_COLUMN_NOT_IN_SELECT`.

## Filtering: `DynamicConditionForModel`

`DynamicConditionForModel<Model>` is the type of the filter: each property of the interface can be used with the operators of its TypeScript type. You pass the filter to `dynamicConditionFor(availableFields).withValues(...)`. [Dynamic filters](../caller-decides/filters.md) explains what a filter can do.

```ts
import { DynamicConditionForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

interface CustomerFilterRow {
    id: number
    name: string
    birthday?: Date
}

async function filterCustomers(connection: DBConnection, filter: DynamicConditionForModel<CustomerFilterRow>): Promise<CustomerFilterRow[]> {
    const availableFields = {
        id: tCustomer.id,
        name: tCustomer.name,
        birthday: tCustomer.birthday
    }

    const dynamicWhere = connection.dynamicConditionFor(availableFields).withValues(filter)

    return connection.selectFrom(tCustomer)
        .where(dynamicWhere)
        .select(availableFields)
        .executeSelectMany()
}

// Every key and operator is checked against the model:
const result = filterCustomers(connection, {
    name: { containsInsensitive: 'ACME' },
    birthday: { greaterThan: new Date('1990-01-01') }
})
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        concat(first_name, ?, last_name) as name, 
        birthday as birthday 
    from customer 
    where 
            lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%') 
        and birthday > ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        concat(first_name, ?, last_name) as `name`, 
        birthday as birthday 
    from customer 
    where 
            lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%') 
        and birthday > ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name || :0 || last_name as "name", 
        birthday as "birthday" 
    from customer 
    where 
            lower(first_name || :1 || last_name) like lower('%' || :2 || '%') escape '\' 
        and birthday > :3
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name || $1 || last_name as name, 
        birthday as birthday 
    from customer 
    where 
            (first_name || $2 || last_name) ilike ('%' || $3 || '%') 
        and birthday > $4
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name || ?1 || last_name as name, 
        birthday as birthday 
    from customer 
    where 
            lower(first_name || ?2 || last_name) like lower('%' || ?3 || '%') escape '\' 
        and birthday > ?4
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name + @0 + last_name as name, 
        birthday as birthday 
    from customer 
    where 
            lower(first_name + @1 + last_name) like lower('%' + @2 + '%') 
        and birthday > @3
    ```

The parameters are: `[ ' ', ' ', 'ACME', '1990-01-01' ]` (on Oracle and SQL Server: `[ ' ', ' ', 'ACME', 1990-01-01T00:00:00.000Z ]`)

These are the operators each property gets. Every operator also has its `IfValue` variant, and it makes no difference whether the property is optional.

| Property in the interface | Usual column | Filter | Operators |
|---|---|---|---|
| `boolean` | Boolean | `BooleanFilter` | Equality: `equals`, `notEquals`, `is`, `isNot`, `in`, `notIn`, `isNull`, `isNotNull` |
| `number` | Integer or double | `NumberFilter` | Equality, and comparison: `lessThan`, `greaterThan`, `lessOrEqual`, `greaterOrEqual` |
| `bigint` | Bigint | `BigintFilter` | Equality and comparison |
| `string` | String or uuid | `StringFilter` | Equality, comparison and text: `contains`, `startsWith`, `endsWith`, `like`, `equalsInsensitive`... |
| `Date` | Date, time or date and time | `DateTimeFilter` | Equality and comparison |
| A union of literals, like `'active' \| 'inactive'` | Enum | `EqualableFilter<...>` | Equality |
| An object | A group of the map | A nested filter | The ones of its properties, and its own `and`, `or` and `not` |

The interface can't say whether a `Date` is a date or a date and time, and it doesn't need to: the column decides how the value is sent. In the example `birthday` is a date, so SQLite receives `'1990-01-01'`.

The compiler checks the filters written in your code. A filter that arrives as data at runtime has no types, and [`withValues` checks it when it runs](../caller-decides/filters.md#a-filter-that-is-wrong).

For [rules of your own](../caller-decides/filters.md#rules-of-your-own), pass the object with the rules as the second argument of `dynamicConditionFor(availableFields, extension)`, and its type as the second argument of the filter type: `DynamicConditionForModel<Model, typeof extension>`. The rules are written against the tables, so the type of that object depends on them.

## Picking columns: `dynamicPickPaths` + `DeepPick`

The caller says which columns come back, with a list of names. A property inside a group is written with its path, like `company.name`, and `company` alone means the whole group. Four pieces work together:

| Piece | What it does |
|---|---|
| `DeepPickPaths<Model>` | The names the caller can pass, like `keyof` but with paths |
| `DeepPick<Model, PICKED>` | The type of a row with only the columns in `PICKED`, like `Pick` but with paths |
| `dynamicPickPaths(availableFields, fields, ['id'])` | Returns the map with only the columns picked, to pass to `select`. The third argument is what is always returned |
| `expandTypeFromDynamicPickPaths(availableFields, fields, rows, ['id'])` | Gives the rows a type that fits `DeepPick` without a cast, and returns them as they are |

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"
import type { DeepPick, DeepPickPaths } from "ts-sql-query" // or "ts-sql-query/extras/deepUtilities"

interface CustomerPickRow {
    id: number
    name: string
    company?: {
        id: number
        name: string
    }
}

async function pickCustomerColumns<FIELDS extends DeepPickPaths<CustomerPickRow>>(connection: DBConnection, fields: FIELDS[]): Promise<DeepPick<CustomerPickRow, FIELDS | 'id'>[]> {
    const company = tCompany.forUseInLeftJoinAs('company')

    const availableFields = {
        id: tCustomer.id,
        name: tCustomer.name,
        company: {
            id: company.id,
            name: company.name
        }
    }

    // always include id; the optional left join is pruned when no company field is picked
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])

    const customers = await connection.selectFrom(tCustomer)
        .optionalLeftOuterJoin(company).on(company.id.equals(tCustomer.companyId))
        .select(selectedFields)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, customers, ['id'])
}

// 'name' | 'company.name' are valid paths; the result is typed DeepPick<CustomerPickRow, ...>
const result = pickCustomerColumns(connection, ['name', 'company.name'])
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        concat(customer.first_name, ?, customer.last_name) as name, 
        company.name as `company.name` 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        concat(customer.first_name, ?, customer.last_name) as `name`, 
        company.`name` as `company.name` 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name || :0 || customer.last_name as "name", 
        company.name as "company.name" 
    from customer 
    left outer join company company on company.id = customer.company_id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name || $1 || customer.last_name as name, 
        company.name as "company.name" 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name || ?1 || customer.last_name as name, 
        company.name as "company.name" 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name + @0 + customer.last_name as name, 
        company.name as [company.name] 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```

The parameters are: `[ ' ' ]`

When the interface has no groups, the built-in `keyof` and `Pick<Model, K>` are enough: see [Expanding result types](../helper-types/picks.md#expanding-result-types-from-dynamic-picks). [Deep utilities](../../advanced/deep-utilities.md) explains `DeepPick` and `DeepPickPaths`, and [Dynamic picks](../helper-types/picks.md) the pick functions.

## Ordering: `OrderByForModel`

`OrderByForModel<Model>` is one clause: the path of a property, which may be followed by a mode, like `'name'`, `'name insensitive'` or `'company.name desc nulls last'`. An order by several columns is an array of clauses. A group alone, like `company`, or an array property can't be a clause. The modes are `asc`, `desc`, each with `nulls first` or `nulls last`, and any of these, or none, followed by `insensitive`. They are exported as the type [`OrderByMode`](../helper-types/order-by.md#orderbymode).

```ts
import type { OrderByForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"

interface CustomerSortRow {
    id: number
    name: string
    birthday?: Date
}

async function sortCustomers(connection: DBConnection, orderBy: OrderByForModel<CustomerSortRow>[]): Promise<CustomerSortRow[]> {
    const availableFields = {
        id: tCustomer.id,
        name: tCustomer.name,
        birthday: tCustomer.birthday
    }

    return connection.selectFrom(tCustomer)
        .select(availableFields)
        .orderByFromStringArrayIfValue(orderBy)
        .executeSelectMany()
}

// each clause is constrained to the model's leaves and the valid ordering modes
const result = sortCustomers(connection, ['name asc', 'birthday desc nulls last'])
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        concat(first_name, ?, last_name) as name, 
        birthday as birthday 
    from customer 
    order by 
        name asc, 
        birthday desc
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        concat(first_name, ?, last_name) as `name`, 
        birthday as birthday 
    from customer 
    order by 
        `name` asc, 
        birthday desc
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name || :0 || last_name as "name", 
        birthday as "birthday" 
    from customer 
    order by 
        "name" asc, 
        "birthday" desc nulls last
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name || $1 || last_name as name, 
        birthday as birthday 
    from customer 
    order by 
        name asc, 
        birthday desc nulls last
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name || ?1 || last_name as name, 
        birthday as birthday 
    from customer 
    order by 
        name asc, 
        birthday desc nulls last
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name + @0 + last_name as name, 
        birthday as birthday 
    from customer 
    order by 
        name asc, 
        birthday desc
    ```

The parameters are: `[ ' ' ]`

`orderByFromStringArrayIfValue` also accepts no array at all, and then the query has no order. These methods take plain strings, so `OrderByForModel` is optional. See [Order by from a string](../optional-parts/order-and-page.md#order-by-from-a-string).

## The filter, the columns and the order in one function

The types of `fields`, `filter`, `orderBy` and of the rows returned all come from the same interface:

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"
import { DynamicConditionForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"
import type { OrderByForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"
import type { DeepPick, DeepPickPaths } from "ts-sql-query" // or "ts-sql-query/extras/deepUtilities"

interface CustomerDirectoryRow {
    id: number
    name: string
    birthday?: Date
    company?: {
        id: number
        name: string
    }
}

async function listCustomerDirectory<FIELDS extends DeepPickPaths<CustomerDirectoryRow>>(
    connection: DBConnection,
    fields: FIELDS[],
    filter: DynamicConditionForModel<CustomerDirectoryRow>,
    orderBy?: OrderByForModel<CustomerDirectoryRow>[]
): Promise<DeepPick<CustomerDirectoryRow, FIELDS | 'id'>[]> {
    const company = tCompany.forUseInLeftJoinAs('company')

    const availableFields = {
        id: tCustomer.id,
        name: tCustomer.name,
        birthday: tCustomer.birthday,
        company: {
            id: company.id,
            name: company.name
        }
    }

    const dynamicWhere = connection.dynamicConditionFor(availableFields).withValues(filter)
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])

    const customers = await connection.selectFrom(tCustomer)
        .optionalLeftOuterJoin(company).on(company.id.equals(tCustomer.companyId))
        .where(dynamicWhere)
        .select(selectedFields)
        .orderByFromStringArrayIfValue(orderBy)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, customers, ['id'])
}

// fields, filter and orderBy are all validated against CustomerDirectoryRow
const result = listCustomerDirectory(connection, ['name', 'company.name'],
    { name: { containsInsensitive: 'ACME' }, company: { name: { equals: 'ACME Corp' } } },
    ['company.name asc nulls last', 'name desc'])
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        concat(customer.first_name, ?, customer.last_name) as name, 
        company.name as `company.name` 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    where 
            lower(concat(customer.first_name, ?, customer.last_name)) like concat('%', lower(?), '%') 
        and company.name = ? 
    order by 
        company.name is null, 
        `company.name` asc, 
        name desc
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        concat(customer.first_name, ?, customer.last_name) as `name`, 
        company.`name` as `company.name` 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    where 
            lower(concat(customer.first_name, ?, customer.last_name)) like concat('%', lower(?), '%') 
        and company.`name` = ? 
    order by 
        company.`name` is null, 
        `company.name` asc, 
        `name` desc
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name || :0 || customer.last_name as "name", 
        company.name as "company.name" 
    from customer 
    left outer join company company on company.id = customer.company_id 
    where 
            lower(customer.first_name || :1 || customer.last_name) like lower('%' || :2 || '%') escape '\' 
        and company.name = :3 
    order by 
        "company.name" asc nulls last, 
        "name" desc
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name || $1 || customer.last_name as name, 
        company.name as "company.name" 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    where 
            (customer.first_name || $2 || customer.last_name) ilike ('%' || $3 || '%') 
        and company.name = $4 
    order by 
        "company.name" asc nulls last, 
        name desc
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name || ?1 || customer.last_name as name, 
        company.name as "company.name" 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    where 
            lower(customer.first_name || ?2 || customer.last_name) like lower('%' || ?3 || '%') escape '\' 
        and company.name = ?4 
    order by 
        "company.name" asc nulls last, 
        name desc
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name + @0 + customer.last_name as name, 
        company.name as [company.name] 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    where 
            lower(customer.first_name + @1 + customer.last_name) like lower('%' + @2 + '%') 
        and company.name = @3 
    order by 
        iif(company.name is null, 1, 0), 
        [company.name] asc, 
        name desc
    ```

The parameters are: `[ ' ', ' ', 'ACME', 'ACME Corp' ]`

`OrderByForModel<CustomerDirectoryRow>` accepts every property of the interface, but a clause can only name a column of this select: if the caller doesn't pick `company.name` and orders by it, the method throws `ORDER_BY_COLUMN_NOT_IN_SELECT`. To order by a column the caller may not pick, make it always returned, in the third argument of `dynamicPickPaths`.

[Functions that return a dynamic select](dynamic-select-functions.md#from-the-model) has a larger function typed this way, next to the same function typed from the columns.

## Custom types and values an interface can't describe

An interface says nothing about the column, so the operators of a property come from its TypeScript type. For most columns that gives the same filter as the column. These are the cases where it doesn't:

| Property in the interface | What the filter offers | What differs from the column |
|---|---|---|
| A branded `string` or `number`, like `number & { brand: 'Money' }` | Equality and comparison, with values of that type | A `custom` column has only equality in its own filter, but a comparison is accepted and sent to the database. The text operators, like `contains`, aren't offered |
| A custom type written as a plain type, like `string` for a `customComparable` column | All the operators of that type | The text operators, like `contains`, aren't in the column's own filter, but they are accepted and sent to the database |
| An object of your own, like a custom type stored in one column | A group of properties, one filter for each | The column is one value, with equality |
| An array, a `Map`, a `Set`, a function, a binary value, a `RegExp`, or a union of different types like `string \| number` | Nothing: the filter can't use that property | |

A branded `bigint`, `boolean` or `Date` keeps the operators of its base type.

To give a property the filter of its column, take it out of the interface and name its type. `DynamicDefinitionForModel<Model>` is the list of types that `DynamicConditionForModel` builds from, and it can be combined with [names of types](../../api/dynamic-conditions.md):

```ts
import { DynamicCondition, DynamicDefinitionForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

type Money = number & { readonly brand: 'Money' }

interface Invoice {
    id: number
    total: Money
}

type InvoiceFilter = DynamicCondition<DynamicDefinitionForModel<Omit<Invoice, 'total'>> & { total: ['customDouble', Money] }>

const filter: InvoiceFilter = {
    id: { equals: 1 },
    total: { greaterThan: 100 as Money }
}
```

## See also

- [Typing dynamic queries from the database types](from-database-types.md): the same function, typed from the columns.
- [Dynamic filters](../caller-decides/filters.md) and [Picking columns dynamically](../caller-decides/picks.md): what the filter and the pick do.
- [Dynamic conditions](../helper-types/conditions.md), [Dynamic picks](../helper-types/picks.md) and [Dynamic order by](../helper-types/order-by.md): the reference of each type.
- [Dynamic conditions API](../../api/dynamic-conditions.md): the operators of each filter and the names of the types.
- [Deep utilities](../../advanced/deep-utilities.md): `DeepPickPaths`, `DeepPick` and `DeepOmit`.
- [Functions that return a dynamic select](dynamic-select-functions.md): both ways side by side in one example.
