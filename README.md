# ts-sql-query <!-- omit in toc -->

[![npm](https://img.shields.io/npm/v/ts-sql-query.svg)](https://npm.im/ts-sql-query)

ts-sql-query is a type-safe query builder that provides a way to build dynamic SQL queries in a type-safe way, that means, the TypeScript compiler verifies the queries. 

Type-safe SQL means the mistakes writting a query will be detected during the compilation time. With ts-sql-query you don't need to be affraid of change the database, the problems caused by the change will be detected during compilation time.

ts-sql-query supports MariaDB, MySql, Oracle, PostgreSql, Sqlite and SqlServer. Note: this is not an ORM, and the most probably is you don't need one.

![](docs/demo.gif)

# Summary <!-- omit in toc -->

- [Install](#install)
- [Documentation](#documentation)
- [Examples](#examples)
- [Why?](#why)
- [Basic queries structure](#basic-queries-structure)
  - [Select one row](#select-one-row)
  - [Other options](#other-options)
- [Dynamic queries](#dynamic-queries)
- [See more](#see-more)
- [Related projects](#related-projects)
- [License](#license)

## Install

Install with [npm](https://www.npmjs.com/):

```sh
$ npm install --save ts-sql-query
```

ts-sql-query doesn't expose a global export; instead, you need import specific files refered in this documentation according to the functionality you need. Only the files included in this documentation are considered public; then, don't reference explicitly files outside of the following:
- `ts-sql-query/Connection`
- `ts-sql-query/Table`
- `ts-sql-query/TypeAdapter`
- `ts-sql-query/View`
- `ts-sql-query/connections/*`
- `ts-sql-query/extras/*`
- `ts-sql-query/queryRunners/*`
- `ts-sql-query/dynamicCondition`

Any reference to a file outside of the previous list can change at any moment.

## Documentation

See the documentation at: https://ts-sql-query.readthedocs.io/

## Examples

You can find a complete example using ts-sql-query with PostgreSQL in the file [PgExample.ts](https://github.com/juanluispaz/ts-sql-query/blob/master/src/examples/PgExample.ts). You can browse the [examples folder](https://github.com/juanluispaz/ts-sql-query/tree/master/src/examples) to see an example for each supported database using different ways to connect to it.

## Why?

There are many libraries available in JavaScript/TypeScript that allows querying a SQL database, but they are typically:

- ORM doesn't allow to take advantage of the full potential of the database.
- String concatenation utilities in the way of query builders.
- Utilities designed without have type-safe criteria.
- Utilities not designed to write dynamic queries in an easy way.

ts-sql-query addresses these inconveniences, providing you with a library that allows you to query the database in a type-safe way, with SQL in mind, and with many helpers to create dynamic queries.

## Basic queries structure

### Select one row

```ts
const customerId = 10;

const customerWithId = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(customerId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    })
    .executeSelectOne();
```

The executed query is:
```sql
select id as id, first_name as firstName, last_name as lastName, birthday as birthday 
from customer 
where id = $1
```

The parameters are: `[ 10 ]`

The result type is:
```ts
const customerWithId: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
}>
```

The `executeSelectOne` returns one result, but if it is not found in the database an exception will be thrown. If you want to return the result when it is found or null when it is not found you must use the `executeSelectNoneOrOne` method.

### Other options

You can execute the query using:

- `executeSelectNoneOrOne(): Promise<RESULT | null>`: Execute the select query that returns one o no result from the database
- `executeSelectOne(): Promise<RESULT>`: Execute the select query that returns one result from the database. If no result is returned by the database an exception will be thrown.
- `executeSelectMany(): Promise<RESULT[]>`: Execute the select query that returns zero or many results from the database
- `executeSelectPage(): Promise<{ data: RESULT[], count: number }>`: Execute the select query that returns zero or many results from the database. Select page execute the query twice, the first one to get the data from the database and the second one to get the count of all data without the limit and the offset.
- `executeSelectPage<EXTRAS extends {}>(extras: EXTRAS): Promise<{ data: RESULT[], count: number } & EXTRAS>`: Execute the select query as a select page, but allows to include extra properties to will be resulting object. If the object provided by argument includes the property count, the query that count the data will be omitted and this value will be used. If the object provided by argument includes the property data, the query that extract the data will be omitted and this value will be used.

## Dynamic queries

ts-sql-query offers many commodity methods with name ended with `IfValue` to build dynamic queries; these methods allow to be ignored when the values specified by argument are `null` or `undefined` or an empty string (only when the `allowEmptyString` flag in the connection is not set to true, that is the default behaviour). When these methods are used in operations that return booleans value, ts-sql-query is smart enough to omit the operation when it is required, even when the operation is part of complex composition with `and`s and `or`s.

When you realize an insert or update, you can:

- set a column value conditionally using the method `setIfValue`
- replace a previously set value during the construction of the query using  the method `setIfSet` or the method `setIfSetIfValue`
- set a value if it was not previously set during the construction of the query using the method `setIfNotSet` or the method `setIfNotSetIfValue`
- ignore a previously set value using the method `ignoreIfSet`
- don't worry if you end with an update or delete with no where, you will get an error instead of update or delete all rows. You can allow explicitly having an update or delete with no where if you create it using the method `updateAllowingNoWhere` or `deleteAllowingNoWhereFrom` respectively

When you realize a select, you can:

- specify in your order by clause that the order must be case insensitive when the column type is string (ignored otherwise). To do it, add `insensitive` at the end of the ordering criteria/mode
- add a dynamic `order by` provided by the user without risk of SQL injection and without exposing the internal structure of the database. To build a dynamic `order by` use the method `orderByFromString` with the usual order by syntax (and with the possibility to use the insensitive extension), but using as column's name the name of the property in the resulting object
- You can apply `order by`, `limit` and `offset` optionally calling `orderByFromStringIfValue`, `limitIfValue` and `offsetIfValue`

Additionally, you can:

- create a boolean expression that only applies if a certain condition is met, calling the `onlyWhen` method in the boolean expression. The `ignoreWhen` method does the opposite.
- create an expression that only applies if a certain condition is met; otherwise, the value will be null, calling the `onlyWhenOrNull` method in the expression. The `ignoreWhenAsNull` method does the opposite.
- create a dynamic boolean expression that you can use in a where (by example), calling the `dynamicBooleanExpresionUsing` method in the connection object.
- create a custom boolean condition from criteria object that you can use in a where (by example), calling the `dynamicConditionFor` method in the connection object. This functionality is useful when creating a complex search & filtering functionality in the user interface, where the user can apply a different combination of constraints.
- create a query where it is possible to pick the columns to be returned by the query.
- define an optional join in a select query. That join only must be included in the final query if the table involved in the join is used in the final query. For example, a column of the joined table was picked or used in a dynamic where.

```ts
const firstNameContains = 'ohn';
const lastNameContains = null;
const birthdayIs = null;
const searchOrderBy = 'name insensitive, birthday asc nulls last';

const searchedCustomers = connection.selectFrom(tCustomer)
    .where(
                tCustomer.firstName.containsIfValue(firstNameContains)
            .or(tCustomer.lastName.containsIfValue(lastNameContains))
        ).and(
            tCustomer.birthday.equalsIfValue(birthdayIs)
        )
    .select({
        id: tCustomer.id,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName),
        birthday: tCustomer.birthday
    })
    .orderByFromString(searchOrderBy)
    .executeSelectMany();
```

The executed query is:
```sql
select id as id, first_name || $1 || last_name as name, birthday as birthday 
from customer 
where first_name like ('%' || $2 || '%') 
order by lower(name), birthday asc nulls last
```

The parameters are: `[ ' ', 'ohn' ]`

The result type is:
```ts
const customerWithId: Promise<{
    id: number;
    name: string;
    birthday?: Date;
}[]>
```

## See more

See more information at: https://ts-sql-query.readthedocs.io/

## Related projects

- [ts-sql-codegen](https://github.com/lorefnon/ts-sql-codegen): Utility that generates table mapper classes for ts-sql-query by inspecting a database through [tbls](https://github.com/k1LoW/tbls).

## License

MIT
