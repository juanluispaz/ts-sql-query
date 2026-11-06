---
search:
  boost: 0.7
---
# Dynamic order by

An order that arrives from outside is received by `orderByFromString` and its variants, explained in [Order and page from a request](../optional-parts/order-and-page.md). They receive a plain `string`, so a wrong order is found only when the code runs. This page is the reference of the types in `ts-sql-query/dynamic/orderBy`, which are also exported from the root `ts-sql-query`, and which let the compiler check that text. Using them is optional, and they don't change the query.

| Type | What it's for | Where it's used |
|---|---|---|
| [`OrderByForModel<Model>`](#orderbyformodel) | One clause of an order, checked against an interface of yours | The value passed to `orderByFromString` and its variants. See [Typing from a business model](../own-function/from-business-model.md#ordering-orderbyformodel) and [from the database types](../own-function/from-database-types.md#ordering-orderbyformodel-over-the-result-row) |
| [`OrderByMode`](#orderbymode) | The modes of an order | The second argument of [`orderBy`](../../queries/select.md#the-order-modes), or a mode kept in a variable |

## OrderByForModel

`OrderByForModel<Model>` is one clause of an order: the path of a property of the model, optionally followed by a mode.

```ts
import type { OrderByForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"

interface Customer {
    id: number
    firstName: string
    lastName: string
    birthday?: Date
    company?: {
        id: number
        name: string
    }
}

// 'id' | 'firstName' | 'company.name' | 'firstName asc' | 'birthday desc nulls last' | …
type CustomerOrder = OrderByForModel<Customer>
```

Only the properties that hold a value can be ordered by, as in `orderByFromString`. A property inside a nested object is written with a dot, like `'company.name'`. The nested object as a whole, `'company'`, isn't accepted, and neither is a property that is an array.

For an order with several columns, use an array of clauses, with `orderByFromStringArray`, or with `orderByFromStringArrayIfValue` if the array or its elements can be missing:

```ts
import type { OrderByForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"

interface Customer {
    id: number
    firstName: string
    lastName: string
    company?: {
        id: number
        name: string
    }
}

const orderBy: OrderByForModel<Customer>[] = ['company.name asc nulls last', 'lastName desc']

const company = tCompany.forUseInLeftJoinAs('company')

const customers = await connection.selectFrom(tCustomer)
    .leftOuterJoin(company).on(company.id.equals(tCustomer.companyId))
    .select({
        id: tCustomer.id,
        lastName: tCustomer.lastName,
        company: {
            name: company.name
        }
    })
    .orderByFromStringArray(orderBy)
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.last_name as lastName, 
        company.name as `company.name` 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    order by 
        company.name is null, 
        `company.name` asc, 
        lastName desc
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.last_name as lastName, 
        company.`name` as `company.name` 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    order by 
        company.`name` is null, 
        `company.name` asc, 
        lastName desc
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.last_name as "lastName", 
        company.name as "company.name" 
    from customer 
    left outer join company company on company.id = customer.company_id 
    order by 
        "company.name" asc nulls last, 
        "lastName" desc
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.last_name as "lastName", 
        company.name as "company.name" 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    order by 
        "company.name" asc nulls last, 
        "lastName" desc
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.last_name as lastName, 
        company.name as "company.name" 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    order by 
        "company.name" asc nulls last, 
        lastName desc
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.last_name as lastName, 
        company.name as [company.name] 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    order by 
        iif(company.name is null, 1, 0), 
        [company.name] asc, 
        lastName desc
    ```

The parameters are: `[]`

The type is checked against the model, and the name is checked against the select when the query is written. A clause with a property of the model that the select doesn't return compiles, and `orderByFromStringArray` throws `ORDER_BY_COLUMN_NOT_IN_SELECT`. See [An order that can't be understood](../optional-parts/order-and-page.md#an-order-that-cant-be-understood).

## OrderByMode

`OrderByMode` is the union of all the modes. These are the same in `OrderByForModel`, in the second argument of `orderBy`, and in the text of `orderByFromString`:

| Order | Rows without a value where the database puts them | Rows without a value first | Rows without a value last |
|---|---|---|---|
| Ascending | `'asc'` | `'asc nulls first'` | `'asc nulls last'` |
| Descending | `'desc'` | `'desc nulls first'` | `'desc nulls last'` |
| Ascending, not distinguishing upper and lower case | `'insensitive'`, `'asc insensitive'` | `'asc nulls first insensitive'` | `'asc nulls last insensitive'` |
| Descending, not distinguishing upper and lower case | `'desc insensitive'` | `'desc nulls first insensitive'` | `'desc nulls last insensitive'` |

[The order modes](../../queries/select.md#the-order-modes) explains what each one does in each database.

Use the type when the mode is apart from the name of the column, like in a variable or an argument of your function:

```ts
import type { OrderByMode } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"

const mode: OrderByMode = 'desc nulls last'

const customers = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderBy('firstName', mode)
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by firstName desc
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by firstName desc
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    order by "firstName" desc nulls last
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    order by "firstName" desc nulls last
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by firstName desc nulls last
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by firstName desc
    ```

The parameters are: `[]`

## See also

- [Order and page from a request](../optional-parts/order-and-page.md): `orderByFromString`, its variants and its errors.
- [Typing from a business model](../own-function/from-business-model.md): a complete function with this type.
- [The order modes](../../queries/select.md#the-order-modes): what each mode does.
