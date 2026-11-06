---
search:
  boost: 1.5
---
# Dynamic filters

A dynamic filter is a condition that arrives as data: a search screen or another system sends an object that says which fields to compare and how, and the library turns it into SQL. The values go as parameters, and the names must be the ones you list, so the object can't add SQL of its own.

It's the condition of a table in a user interface, or of a query API for other systems: see [Queries from a request](queries-from-requests.md) for those two cases applied, with the order and the page.

`connection.dynamicConditionFor(fields)` receives a map: each key is the name the filter uses, and each value is the column or expression it refers to. Its method `withValues(filter)` returns the condition, which goes wherever a boolean is accepted, like a `where`.

| Filter | Condition |
|---|---|
| `{ firstName: { equals: 'John' } }` | The first name is `John` |
| `{ firstName: { startsWith: 'J', endsWith: 'n' } }` | Both comparisons, joined with `and` |
| `{ firstName: { equals: 'John' }, lastName: { equals: 'Smith' } }` | Both fields, joined with `and` |
| `{ and: [a, b] }` | `a` and `b` |
| `{ or: [a, b] }` | `a` or `b` |
| `{ not: a }` | The opposite of `a` |
| `{ firstName: { equalsIfValue: null } }` | No condition: the `IfValue` operators ignore a missing value |
| `{}` | No condition |

The operators of each type are listed in the [Dynamic conditions API](../../api/dynamic-conditions.md).

```ts
import { DynamicCondition } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

const selectFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday,
    companyName: tCompany.name
}

/*
 * You can define as well using the fields object
 * type FilterType = DynamicCondition<typeof selectFields>
 */
type FilterType = DynamicCondition<{
    id: 'int',
    firstName: 'string',
    lastName: 'string',
    birthday: 'localDate',
    companyName: 'string'
}>

const filter: FilterType = {
    or: [
        { firstName: { startsWithInsensitive: 'John' } },
        { lastName: { startsWithInsensitiveIfValue: 'Smi', endsWith: 'th' } }
    ],
    companyName: {equals: 'ACME'}
}

const dynamicWhere = connection.dynamicConditionFor(selectFields).withValues(filter)

const customersWithDynamicCondition = connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCustomer.companyId.equals(tCompany.id))
    .where(dynamicWhere)
    .select(selectFields)
    .orderBy('firstName', 'insensitive')
    .orderBy('lastName', 'asc insensitive')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like concat(lower(?), '%') 
            or (
                    lower(customer.last_name) like concat(lower(?), '%') 
                and customer.last_name like concat('%', ?)
            )
        ) and company.name = ? 
    order by 
        lower(customer.first_name), 
        lower(customer.last_name) asc
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.`name` as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like concat(lower(?), '%') 
            or (
                    lower(customer.last_name) like concat(lower(?), '%') 
                and customer.last_name like concat('%', ?)
            )
        ) and company.`name` = ? 
    order by 
        lower(customer.first_name), 
        lower(customer.last_name) asc
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as "birthday", 
        company.name as "companyName" 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like lower(:0 || '%') escape '\' 
            or (
                    lower(customer.last_name) like lower(:1 || '%') escape '\' 
                and customer.last_name like ('%' || :2) escape '\'
            )
        ) and company.name = :3 
    order by 
        lower("firstName"), 
        lower("lastName") asc
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as birthday, 
        company.name as "companyName" 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               customer.first_name ilike ($1 || '%') 
            or (
                    customer.last_name ilike ($2 || '%') 
                and customer.last_name like ('%' || $3)
            )
        ) and company.name = $4 
    order by 
        lower(customer.first_name), 
        lower(customer.last_name) asc
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like lower(?1 || '%') escape '\' 
            or (
                    lower(customer.last_name) like lower(?2 || '%') escape '\' 
                and customer.last_name like ('%' || ?3) escape '\'
            )
        ) and company.name = ?4 
    order by 
        lower(customer.first_name), 
        lower(customer.last_name) asc
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like lower(@0 + '%') 
            or (
                    lower(customer.last_name) like lower(@1 + '%') 
                and customer.last_name like ('%' + @2)
            )
        ) and company.name = @3 
    order by 
        lower(customer.first_name), 
        lower(customer.last_name) asc
    ```

The parameters are: `[ 'John', 'Smi', 'th', 'ACME' ]`

The result type is:
```tsx
const customersWithDynamicCondition: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    companyName: string;
    birthday?: Date;
}[]>
```

`DynamicCondition`, from `ts-sql-query/dynamic/condition`, is the type of the filter. It's built from type names, as in the example, or from the map of fields. See [Dynamic conditions](../../api/dynamic-conditions.md), the [types of a dynamic condition](../helper-types/conditions.md), and [from a business model](../own-function/from-business-model.md) to build it from your own types.

With an empty filter there is no condition: a select returns all the rows, and an update or delete with no other condition is rejected with `MISSING_WHERE`.

## Empty values in a filter

The types of a filter are strict, and its execution is tolerant. The types keep your own TypeScript code from writing something by mistake: `equals` doesn't accept `null`, and `equalsIfValue` does. But a filter that arrives as data has no types, and while it runs an operator with an empty value restricts nothing:

| Filter | Condition |
|---|---|
| `{ id: { equals: null } }`, or any operator without `IfValue` | No condition |
| `{ name: { contains: '' } }`, unless the connection has [`allowEmptyString`](../../configuration/connection.md#allowing-empty-string) | No condition |
| `{ id: { in: [] } }`, `{ id: { notIn: [] } }` | No condition |
| `{ id: null }` | No condition on `id` |
| `{ id: { isNull: true } }`, `{ id: { is: null } }` | The value is null |

This is what [the uses of a filter](queries-from-requests.md) need. A table sends empty the filters nobody filled in. And a system written in Java or C# usually can't leave out a property: it sends all the fields of its class, with `null` in those it doesn't use, so `{ id: { equals: 1, notEquals: null, in: null } }` means `id = 1`.

Mind the difference with the same methods in your code, which compare with what they receive: `tCustomer.id.in([])` returns no rows, and `tCustomer.id.notIn([])` returns them all.

The same tolerance applies to a value of another shape, as long as the database can receive it: `{ id: { in: 5 } }` is `id in (5)`.

If your API needs to be stricter, for example to tell the caller that `equals: null` isn't accepted, validate the filter before passing it to `withValues`, with a library like Zod.

## What the caller can use

The caller can use every field of the map, with every operator of its type, so list only what they may use. A field restricted with [`allowWhen`](restricting-values.md#refuse-a-query-that-uses-a-value) can stay in the map: the query is refused only if the filter uses it.

## A filter that is wrong

A filter that comes from outside can be wrong. `withValues` throws when you call it, with a [`TsSqlProcessingError`](../../api/error-management/library-raised-errors.md) that has one of these reasons:

| Reason | When |
|---|---|
| `DYNAMIC_CONDITION_UNKNOWN_COLUMN` | A name that isn't in the map, nor a rule |
| `DYNAMIC_CONDITION_UNKNOWN_OPERATION` | An operator that doesn't exist, like `{ id: { nope: 1 } }` |
| `DYNAMIC_CONDITION_INVALID_FILTER` | Something else where an object is expected, like `{ id: 1 }`, or an `and` or `or` that isn't an array |

A filter parsed from JSON has its dates as text. Convert them to `Date` first: a text in a date column reaches the execute method, whose promise is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE`.

## Rules of your own

To add a rule that no column can express, like "there is a customer whose name contains this text", pass an object as the second argument of `dynamicConditionFor`, and as the second type argument of `DynamicCondition`. Each key is the name of a rule, and it can be nested to follow the groups of the map. Its value is a function that receives the value of the filter and returns a condition. See [a function that returns a dynamic select](../own-function/dynamic-select-functions.md) for a complete example.

## A filter with nested objects

When the select returns [nested objects](../../queries/complex-projections.md), the filter has the same shape: a field inside a group is inside the same group in the filter, which can have its own `and`, `or` and `not`. The order uses the path of the property, like `company.name`.

```ts
import { DynamicCondition } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

type QueryFilterType = DynamicCondition<{
    id: 'int',
    name: {
        firstName: 'string',
        lastName: 'string',
    },
    birthday: 'localDate',
    company: {
        id: 'int',
        name: 'string'
    }
}>;

const queryFilter: QueryFilterType = {
    company: { name: {equals: 'ACME'} },
    name: {
        or: [
            { firstName: { containsInsensitive: 'John' } },
            { lastName: { containsInsensitive: 'Smi' } }
        ]
    }
};

const queryOrderBy = 'company.name asc insensitive, birthday desc';

const querySelectFields = {
    id: tCustomer.id,
    name: {
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
    },
    birthday: tCustomer.birthday,
    company: {
        id: tCompany.id,
        name: tCompany.name
    }
};

const queryDynamicWhere = connection.dynamicConditionFor(querySelectFields).withValues(queryFilter);

const customerWithCompanyObject = connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select(querySelectFields)
    .where(queryDynamicWhere)
    .orderByFromString(queryOrderBy)
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as `name.firstName`, 
        customer.last_name as `name.lastName`, 
        customer.birthday as birthday, 
        company.id as `company.id`, 
        company.name as `company.name` 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = ? 
        and (
               lower(customer.first_name) like concat('%', lower(?), '%') 
            or lower(customer.last_name) like concat('%', lower(?), '%')
        ) 
    order by 
        lower(company.name) asc, 
        birthday desc
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as `name.firstName`, 
        customer.last_name as `name.lastName`, 
        customer.birthday as birthday, 
        company.id as `company.id`, 
        company.`name` as `company.name` 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.`name` = ? 
        and (
               lower(customer.first_name) like concat('%', lower(?), '%') 
            or lower(customer.last_name) like concat('%', lower(?), '%')
        ) 
    order by 
        lower(company.`name`) asc, 
        birthday desc
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        customer.birthday as "birthday", 
        company.id as "company.id", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = :0 
        and (
               lower(customer.first_name) like lower('%' || :1 || '%') escape '\' 
            or lower(customer.last_name) like lower('%' || :2 || '%') escape '\'
        ) 
    order by 
        lower("company.name") asc, 
        "birthday" desc
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        customer.birthday as birthday, 
        company.id as "company.id", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = $1 
        and (
               customer.first_name ilike ('%' || $2 || '%') 
            or customer.last_name ilike ('%' || $3 || '%')
        ) 
    order by 
        lower(company.name) asc, 
        birthday desc
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        customer.birthday as birthday, 
        company.id as "company.id", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = ?1 
        and (
               lower(customer.first_name) like lower('%' || ?2 || '%') escape '\' 
            or lower(customer.last_name) like lower('%' || ?3 || '%') escape '\'
        ) 
    order by 
        lower(company.name) asc, 
        birthday desc
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as [name.firstName], 
        customer.last_name as [name.lastName], 
        customer.birthday as birthday, 
        company.id as [company.id], 
        company.name as [company.name] 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = @0 
        and (
               lower(customer.first_name) like lower('%' + @1 + '%') 
            or lower(customer.last_name) like lower('%' + @2 + '%')
        ) 
    order by 
        lower(company.name) asc, 
        birthday desc
    ```

The parameters are: `[ "ACME", "John", "Smi" ]`

The result type is:
```tsx
const customerWithCompanyObject: Promise<{
    id: number;
    name: {
        firstName: string;
        lastName: string;
    };
    company: {
        id: number;
        name: string;
    };
    birthday?: Date;
}>
```

The operators of each type and the types of a filter are in [Dynamic conditions](../../api/dynamic-conditions.md).
