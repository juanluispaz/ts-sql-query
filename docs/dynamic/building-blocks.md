---
search:
  boost: 2
---
# What a dynamic query can do

A search form, a table with filters, an API that other systems query: in all of them, what the query has to do is only known when it runs. The usual way of handling this is assembling the query with `if`s and pieces of SQL. The code stops looking like the query it builds, each new option multiplies the cases, and the types can't follow the result.

In `ts-sql-query` you write one query with every part that can vary, and the library writes the SQL with only what applies. This goes far beyond optional conditions: the filter can arrive as an object, the caller can choose the columns, and a function can return exactly the type of what was asked for. This page shows how far it goes, with one query growing step by step, and then lists everything on offer.

## One query, growing

### A condition that may not apply

An `*IfValue` method compares with a value that may be missing. Without a value, the condition disappears:

```ts
const firstName: string | null = null

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.firstName.containsIfValue(firstName))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer
    ```

The parameters are: `[]`

Here the query has no `where`. See [Dynamic queries](../queries/dynamic-queries.md).

### The order and the page come from a request

The order arrives as text, and it can only name properties of the select. The limit and the offset may be missing:

```ts
const request: { firstName?: string, order?: string, limit?: number, offset?: number } = { firstName: 'ohn', order: 'firstName desc', limit: 10 }

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.firstName.containsIfValue(request.firstName))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderByFromStringIfValue(request.order)
    .limitIfValue(request.limit)
    .offsetIfValue(request.offset)
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where first_name like concat('%', ?, '%') 
    order by firstName desc 
    limit ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where first_name like concat('%', ?, '%') 
    order by firstName desc 
    limit ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    where first_name like ('%' || :0 || '%') escape '\' 
    order by "firstName" desc 
    fetch next :1 rows only
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    where first_name like ('%' || $1 || '%') 
    order by "firstName" desc 
    limit $2
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where first_name like ('%' || ?1 || '%') escape '\' 
    order by firstName desc 
    limit ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where first_name like ('%' + @0 + '%') 
    order by firstName desc 
    offset 0 rows 
    fetch next @1 rows only
    ```

The parameters are: `[ 'ohn', 10 ]`

See [Order and page from a request](order-and-page.md).

### The filter comes from the request too

Instead of one parameter per condition, the caller sends an object that says which fields to compare and how, with `and`, `or` and `not` if it needs them. You list the fields it can use, and your own conditions stay in the code, where the filter can't remove them:

```ts
import { DynamicCondition } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

const filterableFields = {
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName
}

const companyOfTheUser = 16
const filter: DynamicCondition<typeof filterableFields> = {
    or: [
        { firstName: { startsWithInsensitive: 'John' } },
        { lastName: { containsInsensitive: 'Smi' } }
    ]
}

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.equals(companyOfTheUser))
    .and(connection.dynamicConditionFor(filterableFields).withValues(filter))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where 
            company_id = ? 
        and (lower(first_name) like concat(lower(?), '%') or lower(last_name) like concat('%', lower(?), '%'))
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where 
            company_id = ? 
        and (lower(first_name) like concat(lower(?), '%') or lower(last_name) like concat('%', lower(?), '%'))
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    where 
            company_id = :0 
        and (lower(first_name) like lower(:1 || '%') escape '\' or lower(last_name) like lower('%' || :2 || '%') escape '\')
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    where 
            company_id = $1 
        and (first_name ilike ($2 || '%') or last_name ilike ('%' || $3 || '%'))
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where 
            company_id = ?1 
        and (lower(first_name) like lower(?2 || '%') escape '\' or lower(last_name) like lower('%' || ?3 || '%') escape '\')
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where 
            company_id = @0 
        and (lower(first_name) like lower(@1 + '%') or lower(last_name) like lower('%' + @2 + '%'))
    ```

The parameters are: `[ 16, 'John', 'Smi' ]`

See [Dynamic filters](filters.md).

### The caller chooses the columns, and the joins follow

You write every column that can be returned, and the query has only those that were picked. A table that nothing needs isn't joined:

```ts
import { dynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    companyName: tCompany.name
}

const customers = await connection.selectFrom(tCustomer)
    .optionalJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select(dynamicPickPaths(availableFields, ['firstName'], ['id']))
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer
    ```

The parameters are: `[]`

With `['firstName']`, the query reads only the id and the first name of `customer`. With `['companyName']`, the same code joins `company`. See [Picking columns dynamically](picks.md) and [Optional joins](optional-joins.md).

### A function whose result is what was asked for

All of that fits in a function of your own, and the type of its result has only the columns the caller asked for:

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths, DynamicPickPaths, PickValuesPath } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"
import { DynamicCondition } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    companyName: tCompany.name
}

type CustomerFields = DynamicPickPaths<typeof availableFields, 'id'>
type CustomerFilter = DynamicCondition<typeof availableFields>

async function getCustomers<FIELDS extends CustomerFields>(fields: FIELDS[], filter: CustomerFilter, order?: string): Promise<PickValuesPath<typeof availableFields, FIELDS | 'id'>[]> {
    const customers = await connection.selectFrom(tCustomer)
        .optionalJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
        .where(connection.dynamicConditionFor(availableFields).withValues(filter))
        .select(dynamicPickPaths(availableFields, fields, ['id']))
        .orderByFromStringIfValue(order)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, customers, ['id'])
}

const customers = await getCustomers(['firstName'], { lastName: { startsWith: 'S' } })
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where last_name like concat(?, '%')
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where last_name like concat(?, '%')
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    where last_name like (:0 || '%') escape '\'
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    where last_name like ($1 || '%')
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where last_name like (?1 || '%') escape '\'
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where last_name like (@0 + '%')
    ```

The parameters are: `[ 'S' ]`

The type of `customers` is:

```tsx
const customers: {
    id: number;
    firstName: string;
}[]
```

It can be typed from the database, as here, or from an interface of your own. See [Functions that return a dynamic select](dynamic-select-functions.md).

## Writing is dynamic too

Inserts and updates set only what they have a value for, and they can add, replace or refuse columns while they are built. An update that ends up without a `where` isn't sent:

```ts
const newFirstName: string | null = 'John'
const newBirthday: Date | null = null

const updatedRows = await connection.update(tCustomer)
    .setIfValue({
        firstName: newFirstName,
        birthday: newBirthday
    })
    .where(tCustomer.id.equals(10))
    .executeUpdate()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    update customer 
    set first_name = ? 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    update customer 
    set first_name = ? 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    update customer 
    set first_name = :0 
    where id = :1
    ```
===+ "PostgreSQL"
    ```postgresql
    update customer 
    set first_name = $1 
    where id = $2
    ```
=== "SQLite"
    ```sqlite
    update customer 
    set first_name = ?1 
    where id = ?2
    ```
=== "SQL Server"
    ```sqlserver
    update customer 
    set first_name = @0 
    where id = @1
    ```

The parameters are: `[ 'John', 10 ]`

Here only `firstName` is set. See [Manipulating values to insert](../queries/insert.md#manipulating-values-to-insert), [Manipulating values to update](../queries/update.md#manipulating-values-to-update) and [A condition that ends up empty](../queries/dynamic-queries.md#a-condition-that-ends-up-empty).

## What holds in all of them

- **One query.** Each of these changes the single query that is built; no extra query is sent to find anything out. The only method that sends two is [`executeSelectPage`](../queries/select-page.md): the rows and the total.
- **What arrives from outside never becomes SQL text.** The values go as parameters, and the names must be among the ones you list or the properties of the select.
- **The types follow the query.** A column that can be left out is optional in the result, and with a function like the one above, the result has what was asked for.

## Everything on offer

| What varies | What to use | Where it's explained |
|---|---|---|
| A condition, if there is a value | `equalsIfValue`, `containsIfValue` and the rest of the `*IfValue` methods | [Easy dynamic queries](../queries/dynamic-queries.md#easy-dynamic-queries) |
| What a condition means without a value | `trueWhenNoValue`, `falseWhenNoValue`, `valueWhenNoValue` | [When there is no value](../queries/dynamic-queries.md#when-there-is-no-value) |
| A condition, if a flag of your code says so | `onlyWhen`, `ignoreWhen` | [Ignorable boolean expression](../queries/dynamic-queries.md#ignorable-boolean-expression) |
| The choice between a condition and none | `connection.noValueBoolean()` | [The neutral boolean](../queries/dynamic-queries.md#the-neutral-boolean) |
| The whole condition, as data | `connection.dynamicConditionFor` | [Dynamic filters](filters.md) |
| A text, if there is a value | `concatIfValue`, `concatIgnoringNullIfValue`, `replaceAllIfValue`, `replaceAllInsensitiveIfValue` | [All the IfValue methods](../queries/dynamic-queries.md#all-the-ifvalue-methods) |
| The order | `orderByFromString`, `orderByFromStringArray` and their `IfValue` variants | [Order and page from a request](order-and-page.md) |
| The page | `limitIfValue`, `offsetIfValue` | [Optional limit and offset](order-and-page.md#optional-limit-and-offset) |
| The joins | `optionalJoin`, `optionalInnerJoin`, `optionalLeftJoin`, `optionalLeftOuterJoin` | [Optional joins](optional-joins.md) |
| The columns | `dynamicPick`, `dynamicPickPaths` | [Picking columns dynamically](picks.md) |
| The value of a column, depending on the user | `onlyWhenOrNull`, `ignoreWhenAsNull` | [Hide a value keeping the column](restricting-values.md#hide-a-value-keeping-the-column) |
| Whether a value can be used at all | `allowWhen`, `disallowWhen` | [Restrict access to values](restricting-values.md#restrict-access-to-values) |
| What an insert or an update writes | `setIfValue`, `setIfSet`, `setIfNotSet`, `setIfHasValue`, `setIfHasNoValue`, each with `IfValue` and `When` variants, `setWhen`, `dynamicSet`, `dynamicValues` | [Manipulating values to insert](../queries/insert.md#manipulating-values-to-insert), [to update](../queries/update.md#manipulating-values-to-update) |
| Which columns stay in an insert or an update | `ignoreIfSet`, `ignoreIfHasValue`, `ignoreIfHasNoValue`, `ignoreAnySetWithNoValueWhen`, `keepOnly`, with their `When` variants | The same |
| Which writes are refused | `disallowIfSet`, `disallowIfNotSet`, `disallowIfValue`, `disallowIfNoValue`, `disallowAnyOtherSet`, with their `When` variants | The same |
| The columns an insert or update can write | `shapedAs` | [Insert and update with a shape](../queries/shapes.md) |
| A fragment of SQL of your own, if there is a value | `buildFragmentWithArgsIfValue`, `buildAggregateFragmentWithArgsIfValue` | [Conditional fragments](../queries/sql-fragments.md#conditional-fragments) |
| The type of a filter | `DynamicCondition`, `DynamicConditionForModel`, `DynamicDefinitionForModel` | [Dynamic conditions](utilities/conditions.md) |
| The type of what is picked and of its result | `DynamicPick`, `DynamicPickPaths`, `PickValuesPath`, `PickValuesPathWithAllProperties`, `expandTypeFromDynamicPickPaths`, and their `ProjectedAsNullable` variants | [Dynamic picks](utilities/picks.md) |
| The same, from an interface of your own | `DeepPick`, `DeepPickPaths`, `DeepOmit` | [Deep utilities](../advanced/deep-utilities.md) |
| The type of the order | `OrderByForModel`, `OrderByMode` | [Dynamic order by](utilities/order-by.md) |
| Conditions added by your own `if`s, when nothing above can express them | `dynamicWhere`, `connection.dynamicBooleanExpressionUsing` | [Building a condition step by step](building-conditions.md) |
| The same, in the `on` of a join or the `having` | `dynamicOn`, `dynamicHaving` | [Dynamic join conditions and having](building-conditions.md#dynamic-join-conditions-and-having) |

## Where to go from here

- For the two usual cases put together, a table of a user interface and an API for other systems, see [Queries from a request](queries-from-requests.md).
- To type a whole function, see [from the database types](from-database-types.md) or [from a business model](from-business-model.md).
- To understand why an optional value is a dynamic filter and not a comparison with null, see [Booleans and three-valued logic](three-valued-booleans.md).
