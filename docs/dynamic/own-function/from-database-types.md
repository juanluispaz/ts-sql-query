---
search:
  boost: 1.5
---
# Typing dynamic queries from the database types

A function that serves many callers receives a filter, the columns to return and an order. Its parameters need types, so that the compiler checks each call and the result has only the columns that were asked for. These types can come from two places: from the columns of the query, or from [an interface you write](from-business-model.md). This page takes them from the columns.

You build one map, usually called `availableFields`: each key is a name the caller uses, and each value is a column or an expression. `typeof availableFields` gives every type the function needs.

| What goes through the function | Its type | What uses it inside the function |
|---|---|---|
| The filter | `DynamicCondition<typeof availableFields>` | `connection.dynamicConditionFor(availableFields).withValues(filter)` |
| The columns to return | `DynamicPickPaths<typeof availableFields>[]` | `dynamicPickPaths(availableFields, fields, ['id'])` |
| The order | `OrderByForModel<Row>[]`, where `Row` is the type of a whole row | `.orderByFromStringArrayIfValue(orderBy)` |
| The rows returned | `PickValuesPath<typeof availableFields, FIELDS>[]` | `expandTypeFromDynamicPickPaths(availableFields, fields, rows, ['id'])` |

The types and the functions can be imported from the root `ts-sql-query`, or from `ts-sql-query/dynamic/condition`, `ts-sql-query/dynamic/pick` and `ts-sql-query/dynamic/orderBy`. Each section below is a complete function you can copy, and the last one has the three together.

## From the columns or from an interface

Both ways are only types: the SQL is built from the map and from the values received, so it's the same SQL with either of them. What changes is what you write and what the rest of your code depends on.

| | From the columns | From an interface |
|---|---|---|
| What you write | The map | The map and the interface |
| Where the map goes | Where the types can see it: `typeof` needs a variable outside the function, or a function that returns the map, with `ReturnType` | Inside the function |
| When a column changes | The types change with it | You change the interface. The compiler tells you when the rows no longer fit it |
| What the types depend on | The tables: the code that uses these types has to see their definitions | Only the interface, which you can share with code that doesn't know the tables |
| Operators of the filter | Those of the column, custom types included | Those of the TypeScript type of the property, so [a custom type may need more](from-business-model.md#custom-types-and-values-an-interface-cant-describe) |

Choose the columns when the function and its callers live with the tables, or when the columns have custom types: there is less to write and nothing to keep in step. Choose an interface when it already exists or has to be shared, like the contract of an API, or when the rest of your code shouldn't depend on the tables.

## Filtering: `DynamicCondition`

`DynamicCondition<typeof availableFields>` is the type of the filter: each key of the map can be used with the operators of its column. You pass the filter to `dynamicConditionFor(availableFields).withValues(...)`. [Dynamic filters](../caller-decides/filters.md) explains what a filter can do.

```ts
import { DynamicCondition } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

const availableFields = {
    id: tCustomer.id,
    name: tCustomer.name,
    birthday: tCustomer.birthday
}

// the filter type derived from the columns
type CustomerFilter = DynamicCondition<typeof availableFields>

async function filterCustomers(connection: DBConnection, filter: CustomerFilter) {
    const dynamicWhere = connection.dynamicConditionFor(availableFields).withValues(filter)

    return connection.selectFrom(tCustomer)
        .where(dynamicWhere)
        .select(availableFields)
        .executeSelectMany()
}

// every key and operator is checked against the columns
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

The parameters are: `[ ' ', ' ', 'ACME', 1990-01-01T00:00:00.000Z ]` (on SQLite: `[ ' ', ' ', 'ACME', '1990-01-01' ]`)

The compiler checks the filters written in your code: a key that isn't in the map, or an operator its column doesn't have, doesn't compile. A filter that arrives as data at runtime has no types, and [`withValues` checks it when it runs](../caller-decides/filters.md#a-filter-that-is-wrong).

For [rules of your own](../caller-decides/filters.md#rules-of-your-own), pass the object with the rules as the second argument of `dynamicConditionFor(availableFields, extension)`, and its type as the second argument of the filter type: `DynamicCondition<typeof availableFields, typeof extension>`.

`DynamicCondition` also accepts names of types instead of columns, as in the first example of [Dynamic filters](../caller-decides/filters.md).

## Picking columns: `DynamicPickPaths` + `PickValuesPath`

The caller says which columns come back, with a list of names. A property inside a group is written with its path, like `company.name`, and `company` alone means the whole group. Four pieces work together:

| Piece | What it does |
|---|---|
| `DynamicPickPaths<typeof availableFields, 'id'>` | The names the caller can pass. The second argument leaves out the ones that are always returned, here `id` |
| `PickValuesPath<typeof availableFields, PICKED>` | The type of a row with only the columns in `PICKED` |
| `dynamicPickPaths(availableFields, fields, ['id'])` | Returns the map with only the columns picked, to pass to `select`. The third argument is what is always returned |
| `expandTypeFromDynamicPickPaths(availableFields, fields, rows, ['id'])` | Gives the rows that type, and returns them as they are |

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths, DynamicPickPaths, PickValuesPath } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const company = tCompany.forUseInLeftJoinAs('company')

const availableFields = {
    id: tCustomer.id,
    name: tCustomer.name,
    company: {
        id: company.id,
        name: company.name
    }
}

// the pickable paths (id is always included) and the result type for a selection
type CustomerFields = DynamicPickPaths<typeof availableFields, 'id'>
type CustomerInfo<FIELDS extends CustomerFields> = PickValuesPath<typeof availableFields, FIELDS | 'id'>

async function pickCustomerColumns<FIELDS extends CustomerFields>(connection: DBConnection, fields: FIELDS[]): Promise<CustomerInfo<FIELDS>[]> {
    // always include id; the optional left join is pruned when no company field is picked
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])

    const customers = await connection.selectFrom(tCustomer)
        .optionalLeftOuterJoin(company).on(company.id.equals(tCustomer.companyId))
        .select(selectedFields)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, customers, ['id'])
}

// 'name' | 'company.name' are valid paths; the result is typed PickValuesPath<…>
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

`PickValuesPath` keeps the optional properties optional, and a group has only what was picked from it. The join of an optional table stays out of the query when [nothing needs it](../caller-decides/picks.md#the-joins-follow-what-is-picked).

[Dynamic picks](../helper-types/picks.md) has the variants for other cases:

| To | Use |
|---|---|
| Keep the columns not picked in the type, as optional | `PickValuesPathWithAllProperties` |
| Type a query that returns the optional values as null | `PickValuesPathProjectedAsNullable`, `PickValuesPathWithAllPropertiesProjectedAsNullable` and `expandTypeProjectedAsNullableFromDynamicPickPaths` |
| Receive the pick as an object of booleans, `{ name: true }`, instead of a list | `dynamicPick` and `DynamicPick` |

## Ordering: `OrderByForModel` over the result row

The type of the order receives the type of a row, not the map, so first compute the whole row with `PickValuesPath`, and pass it to `OrderByForModel`.

`OrderByForModel<Row>` is one clause: the path of a property, which may be followed by a mode, like `'name'`, `'name insensitive'` or `'company.name desc nulls last'`. An order by several columns is an array of clauses. A group alone, like `company`, or an array property can't be a clause. The modes are `asc`, `desc`, each with `nulls first` or `nulls last`, and any of these, or none, followed by `insensitive`. They are exported as the type [`OrderByMode`](../helper-types/order-by.md#orderbymode).

```ts
import type { OrderByForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"
import type { DynamicPickPaths, PickValuesPath } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const availableFields = {
    id: tCustomer.id,
    name: tCustomer.name,
    birthday: tCustomer.birthday
}

// the full result row, used to constrain the order-by to the orderable columns
type CustomerRow = PickValuesPath<typeof availableFields, DynamicPickPaths<typeof availableFields>>

async function sortCustomers(connection: DBConnection, orderBy: OrderByForModel<CustomerRow>[]) {
    return connection.selectFrom(tCustomer)
        .select(availableFields)
        .orderByFromStringArrayIfValue(orderBy)
        .executeSelectMany()
}

// each clause is constrained to the row's leaves and the valid ordering modes
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

The types of `fields`, `filter`, `orderBy` and of the rows returned all come from the same map:

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths, DynamicPickPaths, PickValuesPath } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"
import { DynamicCondition } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"
import type { OrderByForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"

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

type CustomerFields = DynamicPickPaths<typeof availableFields, 'id'>
type CustomerInfo<FIELDS extends CustomerFields> = PickValuesPath<typeof availableFields, FIELDS | 'id'>
type CustomerFilter = DynamicCondition<typeof availableFields>

async function listCustomerDirectory<FIELDS extends CustomerFields>(
    connection: DBConnection,
    fields: FIELDS[],
    filter: CustomerFilter,
    orderBy?: OrderByForModel<CustomerInfo<CustomerFields>>[]
): Promise<CustomerInfo<FIELDS>[]> {
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

// fields, filter and orderBy are all validated against the column map
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

`OrderByForModel<CustomerInfo<CustomerFields>>` accepts every column of the row, but a clause can only name a column of this select: if the caller doesn't pick `company.name` and orders by it, the method throws `ORDER_BY_COLUMN_NOT_IN_SELECT`. To order by a column the caller may not pick, make it always returned, in the third argument of `dynamicPickPaths`.

[Functions that return a dynamic select](dynamic-select-functions.md#from-the-database) has a larger function typed this way. Its map needs the alias of a left join, so `buildCompanyAvailableFields` returns the map and the types use `ReturnType`, and it adds rules of its own to the filter.

## See also

- [Typing dynamic queries from a business model](from-business-model.md): the same function, typed from an interface.
- [Dynamic filters](../caller-decides/filters.md) and [Picking columns dynamically](../caller-decides/picks.md): what the filter and the pick do.
- [Dynamic conditions](../helper-types/conditions.md), [Dynamic picks](../helper-types/picks.md) and [Dynamic order by](../helper-types/order-by.md): the reference of each type.
- [Functions that return a dynamic select](dynamic-select-functions.md): both ways side by side in one example.
