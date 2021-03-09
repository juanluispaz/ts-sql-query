# ts-sql-query <!-- omit in toc -->

[![npm](https://img.shields.io/npm/v/ts-sql-query.svg)](http://npm.im/ts-sql-query)

Type-safe SQL query builder like QueryDSL or JOOQ in Java for TypeScript with MariaDB, MySql, Oracle, PostgreSql, Sqlite and SqlServer support.

This package provides a way to build dynamic SQL queries in a type-safe way, that means, the TypeScript compiler verifies the queries. Note: this is not an ORM, and the most probably is you don't need one.

Type-safe sql means the mistakes writting a query will be detected during the compilation time. With ts-sql-query you don't need to be affraid of change the database, the problems caused by the change will be detected during compilation time.

# Summary <!-- omit in toc -->

- [Install](#install)
- [Examples](#examples)
- [Basic queries](#basic-queries)
  - [Select one row](#select-one-row)
  - [Dynamic queries](#dynamic-queries)
  - [Select with joins and order by](#select-with-joins-and-order-by)
  - [Select with subquery and dynamic order by](#select-with-subquery-and-dynamic-order-by)
  - [Select with aggregate functions and group by](#select-with-aggregate-functions-and-group-by)
  - [Select page](#select-page)
  - [Select with custom sql fragment](#select-with-custom-sql-fragment)
  - [Select with custom reusable sql fragment](#select-with-custom-reusable-sql-fragment)
  - [Select with custom reusable sql fragment if value](#select-with-custom-reusable-sql-fragment-if-value)
  - [Using a select as a view in another select query (SQL with clause)](#using-a-select-as-a-view-in-another-select-query-sql-with-clause)
  - [Insert](#insert)
  - [Insert multiple values](#insert-multiple-values)
  - [Insert from select](#insert-from-select)
  - [Update](#update)
  - [Delete](#delete)
- [Connection, tables & views](#connection-tables--views)
  - [Defining the connection object](#defining-the-connection-object)
  - [Allowing empty string](#allowing-empty-string)
  - [Insensitive strategies](#insensitive-strategies)
  - [Instantiating the connection with the database connection](#instantiating-the-connection-with-the-database-connection)
  - [Instantiating the connection with a mock database connection](#instantiating-the-connection-with-a-mock-database-connection)
  - [Mapping the tables](#mapping-the-tables)
  - [Mapping the views](#mapping-the-views)
  - [Creating methods that allows to call a procedure](#creating-methods-that-allows-to-call-a-procedure)
  - [Creating methods that allows to call a function](#creating-methods-that-allows-to-call-a-function)
- [Supported operations](#supported-operations)
  - [Operations definitions](#operations-definitions)
  - [Connection definition](#connection-definition)
  - [Table definition](#table-definition)
  - [View definition](#view-definition)
  - [Insert definition](#insert-definition)
  - [Update definition](#update-definition)
  - [Delete definition](#delete-definition)
  - [Select definition](#select-definition)
  - [Type adpaters](#type-adpaters)
- [Supported databases](#supported-databases)
  - [MariaDB](#mariadb)
  - [MySql](#mysql)
  - [Oracle](#oracle)
  - [PostgreSql](#postgresql)
  - [Sqlite](#sqlite)
  - [SqlServer](#sqlserver)
- [Supported databases with extended ts types](#supported-databases-with-extended-ts-types)
  - [MariaDB](#mariadb-1)
  - [MySql](#mysql-1)
  - [Oracle](#oracle-1)
  - [PostgreSql](#postgresql-1)
  - [Sqlite](#sqlite-1)
  - [SqlServer](#sqlserver-1)
- [Query runners](#query-runners)
  - [any-db (with connection pool)](#any-db-with-connection-pool)
  - [any-db (with connection)](#any-db-with-connection)
  - [better-sqlite3](#better-sqlite3)
  - [ConsoleLogNoopQueryRunner](#consolelognoopqueryrunner)
  - [ConsoleLogQueryRunner](#consolelogqueryrunner)
  - [LoopBack DataSource](#loopback-datasource)
  - [mariadb (with a connection pool)](#mariadb-with-a-connection-pool)
  - [mariadb (with a connection)](#mariadb-with-a-connection)
  - [MockQueryRunner](#mockqueryrunner)
  - [msnodesqlv8](#msnodesqlv8)
  - [mssql (with a connection pool promise)](#mssql-with-a-connection-pool-promise)
  - [mssql (with a connection pool)](#mssql-with-a-connection-pool)
  - [mysql (with a connection pool)](#mysql-with-a-connection-pool)
  - [mysql (with a connection)](#mysql-with-a-connection)
  - [mysql2 (with a connection pool)](#mysql2-with-a-connection-pool)
  - [mysql2 (with a connection)](#mysql2-with-a-connection)
  - [NoopQueryRunner](#noopqueryrunner)
  - [oracledb (with a connection pool promise)](#oracledb-with-a-connection-pool-promise)
  - [oracledb (with a connection pool)](#oracledb-with-a-connection-pool)
  - [oracledb (with a connection)](#oracledb-with-a-connection)
  - [pg (with a connection pool)](#pg-with-a-connection-pool)
  - [pg (with a connection)](#pg-with-a-connection)
  - [sqlite](#sqlite-2)
  - [sqlite3](#sqlite3)
  - [tedious (with a connection poll)](#tedious-with-a-connection-poll)
  - [tedious (with a connection)](#tedious-with-a-connection)
- [Advanced](#advanced)
  - [Custom booleans values](#custom-booleans-values)
  - [Synchronous query runners](#synchronous-query-runners)
  - [Encrypted ID](#encrypted-id)
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

Any reference to a file outside of the previous list can change at any moment.

## Examples

You can find a complete example using ts-sql-query with PostgreSQL in the file [PgExample.ts](https://github.com/juanluispaz/ts-sql-query/blob/master/src/examples/PgExample.ts). You can browse the [examples folder](https://github.com/juanluispaz/ts-sql-query/tree/master/src/examples) to see an example for each supported database using different ways to connect to it.

## Basic queries

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

### Dynamic queries

ts-sql-query offers many commodity methods with name ended with `IfValue` to build dynamic queries; these methods allow to be ignored when the values specified by argument are `null` or `undefined` or an empty string (only when the allowEmptyString flag in the connection is not set to true, that is the default behaviour). When these methods are used in operations that return booleans value, ts-sql-query is smart enough to omit the operation when it is required, even when the operation is part of complex composition with `and`s and `or`s.

When you realize an insert or update, you can:
- set a column value conditionally using the method `setIfValue`
- replace a previously set value during the construction of the query using  the method `setIfSet` or the method `setIfSetIfValue`
- set a value if it was not previously set during the construction of the query using the method `setIfNotSet` or the method `setIfNotSetIfValue`
- ignore a previously set value using the method `ignoreIfSet`
- don't worry if you end with an update or delete with no where, you will get an error instead of update or delete all rows. You can allow explicitly having an update or delete with no where if you create it using the method `updateAllowingNoWhere` or `deleteAllowingNoWhereFrom` respectively

When you realize a select, you can:
- specify in your order by clause that the order must be case insensitive when the column type is string (ignored otherwise). To do it, add `insensitive` at the end of the ordering criteria/mode
- add a dynamic `order by` provided by the user without risk of SQL injection and without exposing the internal structure of the database. To build a dynamic `order by` use the method `orderByFromString` with the usual order by syntax (and with the possibility to use the insensitive extension), but using as column's name the name of the property in the resulting object

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

### Select with joins and order by

```ts
const firstName = 'John';
const lastName = null;

const company = tCompany.as('comp');
const customersWithCompanyName = connection.selectFrom(tCustomer)
    .innerJoin(company).on(tCustomer.companyId.equals(company.id))
    .where(tCustomer.firstName.startWithInsensitive(firstName))
        .and(tCustomer.lastName.startWithInsensitiveIfValue(lastName))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday,
        companyName: company.name
    })
    .orderBy('firstName', 'insensitive')
    .orderBy('lastName', 'asc insensitive')
    .executeSelectMany();
```

The executed query is:
```sql
select customer.id as id, customer.first_name as firstName, customer.last_name as lastName, customer.birthday as birthday, comp.name as companyName
from customer inner join company as comp on customer.company_id = comp.id 
where customer.first_name ilike ($1 || '%') 
order by lower(firstName), lower(lastName) asc
```

The parameters are: `[ 'John' ]`

The result type is:
```ts
const customersWithCompanyName: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    companyName: string;
    birthday?: Date;
}[]>
```

### Select with subquery and dynamic order by

```ts
const orderBy = 'customerFirstName asc nulls first, customerLastName';

const customerWithSelectedCompanies = connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.in(
        connection.selectFrom(tCompany)
            .where(tCompany.name.contains('Cia.'))
            .selectOneColumn(tCompany.id)
    )).select({
        customerId: tCustomer.id,
        customerFirstName: tCustomer.firstName,
        customerLastName: tCustomer.lastName
    }).orderByFromString(orderBy)
    .executeSelectMany();
```

The executed query is:
```sql
select id as customerId, first_name as customerFirstName, last_name as customerLastName 
from customer 
where company_id in (
    select id as result from company where name like ('%' || $1 || '%')
) 
order by customerFirstName asc nulls first, customerLastName
```

The parameters are: `[ 'Cia.' ]`

The result type is:
```ts
const customerWithSelectedCompanies: Promise<{
    customerId: number;
    customerFirstName: string;
    customerLastName: string;
}[]>
```

### Select with aggregate functions and group by

```ts
const customerCountPerCompany = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .groupBy(tCompany.id, tCompany.name)
    .select({
        companyId: tCompany.id,
        companyName: tCompany.name,
        customerCount: connection.count(tCustomer.id)
    })
    .executeSelectMany();
```

The executed query is:
```sql
select company.id as companyId, company.name as companyName, count(customer.id) as customerCount 
from company inner join customer on customer.company_id = company.id 
group by company.id, company.name
```

The parameters are: `[]`

The result type is:
```ts
const customerCountPerCompany: Promise<{
    companyId: number;
    companyName: string;
    customerCount: number;
}[]>
```

### Select page

Select page execute the query twice, the first one to get the data from the database and the second one to get the count of all data without the limit and the offset. Note: select page is only available if you don't define a group by clause.

```ts
const customerName = 'Smi'

const customerPageWithName = connection.selectFrom(tCustomer)
    .where(
        tCustomer.firstName.startWithInsensitive(customerName)
    ).or(
        tCustomer.lastName.startWithInsensitive(customerName)
    ).select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderBy('firstName')
    .orderBy('lastName')
    .limit(10)
    .offset(20)
    .executeSelectPage();
```

The executed query to get the data is:
```sql
select id as id, first_name as firstName, last_name as lastName 
from customer 
where first_name ilike ($1 || '%') 
    or last_name ilike ($2 || '%') 
order by firstName, lastName 
limit $3 
offset $4
```

And its parameters are: `[ 'Smi', 'Smi', 10, 20 ]`

The executed query to get the count is:
```sql
select count(*) 
from customer 
where first_name ilike ($1 || '%') 
    or last_name ilike ($2 || '%')
```

And its parameters are: `[ 'Smi', 'Smi' ]`

The result type is:
```ts
const customerPageWithName: Promise<{
    data: {
        id: number;
        firstName: string;
        lastName: string;
    }[];
    count: number;
}>
```

### Select with custom sql fragment

Sql fragments allows to include sql in your query, that give you the possibility to do some operations not included in ts-sql-query.

```ts
const id = 10;

const customersUsingCustomFragment = connection.selectFrom(tCustomer)
    .where(connection.fragmentWithType('boolean', 'required').sql`!!${tCustomer.id} = !!${connection.const(id, 'int')}`)
    .select({
        idAsString: connection.fragmentWithType('string', 'required').sql`${tCustomer.id}::varchar`,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName)
    })
    .executeSelectNoneOrOne();
```

The executed query is:
```sql
select id::varchar as idAsString, first_name || $1 || last_name as name 
from customer 
where !!id = !!$2
```

The parameters are: `[ ' ', 10 ]`

The result type is:
```ts
const customersUsingCustomFragment: Promise<{
    idAsString: string;
    name: string;
} | null>
```

### Select with custom reusable sql fragment

You can define functions in your connection that create custom reusable sql fragments, that give you the possibility to do some operations or functions not included in ts-sql-query.

If you define your connection like:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 

    bitwiseShiftLeft = this.buildFragmentWithArgs(
        this.arg('int', 'required'),
        this.arg('int', 'required')
    ).as((left, right) => {
        // The fragment here is: ${left} << ${right}
        // Could be another fragment like a function call: myFunction(${left}, ${right})
        return this.fragmentWithType('int', 'required').sql`${left} << ${right}`
    })
}
```

You will define the function `bitwiseShiftLeft` that receives two `int` as argument and returns an `int`; this arguments can be numbers or elements in the database that represents integer numbers. If you create the argument using the function `valueArg` instead of the `arg` function, the defined function only will accept values but not elements of the database. You can use the defined function as a regular database function in your query.

```ts
const bitwiseMovements = 1;
const multiplier = 2;

const companiesUsingCustomFunctionFragment = connection.selectFrom(tCompany)
    .where(tCompany.id.multiply(multiplier).equals(connection.bitwiseShiftLeft(tCompany.id, bitwiseMovements)))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        idMultiplyBy2: connection.bitwiseShiftLeft(tCompany.id, bitwiseMovements)
    })
    .executeSelectMany();
```

The executed query is:
```sql
select id as id, name as name, id << $1 as idMultiplyBy2 
from company 
where (id * $2) = (id << $3)
```

The parameters are: `[ 1, 2, 1 ]`

The result type is:
```ts
const companiesUsingCustomFunctionFragment: Promise<{
    id: number;
    name: string;
    idMultiplyBy2: number;
}[]>
```

### Select with custom reusable sql fragment if value

You can define functions in your connection that create custom reusable sql fragments that have the same behaviour of the functions with name ended with `IfValue`, that give you the possibility to do some operations or functions not included in ts-sql-query.

ts-sql-query offers many commodity methods with name ended with `IfValue` to build dynamic queries; these methods allow to be ignored when the values specified by argument are `null` or `undefined` or an empty string (only when the allowEmptyString flag in the connection is not set to true, that is the default behaviour). When these methods are used in operations that return booleans value, ts-sql-query is smart enough to omit the operation when it is required, even when the operation is part of complex composition with `and`s and `or`s.

The method `buildFragmentWithArgsIfValue` allows you to create a function, where if any optional value argument receives `null` or `undefined` or an empty string, the execution of the provided function is omitted.

If you define your connection like:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 

    valuePlusOneEqualsIfValue = this.buildFragmentWithArgsIfValue(
        this.arg('int', 'required'),
        this.valueArg('int', 'optional')
    ).as((left, right) => {
        // The fragment here is: ${left} + 1 = ${right}
        // Could be another fragment like a function call: myFunction(${left}, ${right})
        return this.fragmentWithType('boolean', 'required').sql`${left} + 1 = ${right}`
    })
}
```

You will define the function `bitwiseShiftLeft` that receives two `int` as argument and returns an `int`; this arguments can be numbers or elements in the database that represents integer numbers. If you create the argument using the function `valueArg` instead of the `arg` function, the defined function only will accept values but not elements of the database. You can use the defined function as a regular database function in your query.

```ts
const noValue = null
const withValue = 2

const companiesUsingCustomFunctionFragmentIfValue = connection.selectFrom(tCompany)
    .where(connection.valuePlusOneEqualsIfValue(tCompany.id, noValue))
        .or(connection.valuePlusOneEqualsIfValue(tCompany.id, withValue))
    .select({
        id: tCompany.id,
        name: tCompany.name,
    })
    .executeSelectMany()
```

The executed query is:
```sql
select id as id, name as name 
from company 
where id + 1 = $1
```

The parameters are: `[ 2 ]`

The result type is:
```ts
const companiesUsingCustomFunctionFragment: Promise<{
    id: number;
    name: string;
}[]>
```

### Using a select as a view in another select query (SQL with clause)

You can define a select query and use it as it were a view in another select query. To allow ait you must call the `forUseInQueryAs` instead of executing the query; this will return a view representation of the query as it were a view, and the query will be included as a `with` clause in the final sql query with the name indicated by argument to the `forUseInQueryAs` method.

```ts
const customerCountPerCompanyWith = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .select({
        companyId: tCompany.id,
        companyName: tCompany.name,
        customerCount: connection.count(tCustomer.id)
    }).groupBy('companyId', 'companyName')
    .forUseInQueryAs('customerCountPerCompany');

const customerCountPerAcmeCompanies = connection.selectFrom(customerCountPerCompanyWith)
    .where(customerCountPerCompanyWith.companyName.containsInsensitive('ACME'))
    .select({
        acmeCompanyId: customerCountPerCompanyWith.companyId,
        acmeCompanyName: customerCountPerCompanyWith.companyName,
        acmeCustomerCount: customerCountPerCompanyWith.customerCount
    })
    .executeSelectMany();
```

The executed query is:
```sql
with
    customerCountPerCompany as (
        select company.id as companyId, company.name as companyName, count(customer.id) as customerCount
        from company inner join customer on customer.company_id = company.id
        group by company.id, company.name
    )
select companyId as "acmeCompanyId", companyName as "acmeCompanyName", customerCount as "acmeCustomerCount"
from customerCountPerCompany
where companyName ilike ('%' || $1 || '%')
```

The parameters are: `[ 'ACME' ]`

The result type is:
```ts
const customerCountPerAcmeCompanies: Promise<{
    acmeCompanyId: number;
    acmeCompanyName: string;
    acmeCustomerCount: number;
}[]>
```

### Insert

```ts
const insertCustomer = connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    }).setIfNotSet({
        birthday: new Date()
    }).returningLastInsertedId()
    .executeInsert();
```

The executed query is:
```sql
insert into customer (first_name, last_name, company_id, birthday) 
values ($1, $2, $3, $4) 
returning id
```

The parameters are: `[ 'John', 'Smith', 1, 2019-08-16T15:02:32.849Z ]`

The result type is a promise with the id of the last inserted row:
```ts
const insertCustomer: Promise<number>
```

### Insert multiple values

```ts
const valuesToInsert = [
    {
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    },
    {
        firstName: 'Other',
        lastName: 'Person',
        companyId: 1
    }
]

const insertMultipleCustomers = connection.insertInto(tCustomer)
    .values(valuesToInsert)
    .returningLastInsertedId()
    .executeInsert();
```

The executed query is:
```sql
insert into customer (first_name, last_name, company_id)
values 
    ($1, $2, $3),
    ($4, $5, $6) 
returning id
```

The parameters are: `[ 'John', 'Smith', 1, 'Other', 'Person', 1 ]`

The result type is a promise with the id of the last inserted row:
```ts
const insertMultipleCustomers: Promise<number[]>
```

**Note**: Return the last inserted id of an insert with multiple rows is only supported by **PostgreSql**, **SqlServer** and **Oracle**. If you try to use it with other database you will get a compilation error.

### Insert from select

```ts
const insertCustomersFromSelect = connection.insertInto(tCustomer)
    .from(
        connection.selectFrom(tCustomer)
        .where(
            tCustomer.companyId.equals(1)
        )
        .select({
            firstName: tCustomer.firstName,
            lastName: tCustomer.lastName,
            companyId: tCustomer.companyId
        })
    )
    .executeInsert();
```

The executed query is:
```sql
insert into customer (first_name, last_name, company_id) 
select first_name as firstName, last_name as lastName, company_id as companyId 
from customer 
where company_id = $1 
```

The parameters are: `[ 1 ]`

The result type is a promise with the number of inserted rows:
```ts
const insertCustomer: Promise<number>
```

### Update

```ts
const updateCustomer = connection.update(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        birthday: new Date()
    }).ignoreIfSet('birthday')
    .where(tCustomer.id.equals(10))
    .executeUpdate();
```

The executed query is:
```sql
update customer 
set first_name = $1, last_name = $2 
where id = $3
```

The parameters are: `[ 'John', 'Smith', 10 ]`

The result type is a promise with the number of updated rows:
```ts
const updateCustomer: Promise<number>
```

### Delete

```ts
const deleteCustomer = connection.deleteFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .executeDelete();
```

The executed query is:
```sql
delete from customer 
where id = $1
```

The parameters are: `[ 10 ]`

The result type is a promise with the number of deleted rows:
```ts
const deleteCustomer: Promise<number>
```

## Connection, tables & views

### Defining the connection object

When you define the connection object, you extend your database connection class; that class receives one generic argument with a unique name for the database in your system.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { }
```

### Allowing empty string

By default empty string as treated as null, if you want to allow to send and receive empty string to the database set the allowEmptyString property in the connection to true.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 
    allowEmptyString = true
}
```

**Recommendation**: Set this flag at the beginning of the project or create a derivated connection if you require to do it. Changing this flag change the way of the SQL query are constructed when you use the methods that the name ends in 'IfValue'.

### Insensitive strategies

By default, when you specify that you want to perform an insensitive operation (like `startWithInsensitive`) the operation is performed calling the function `lower` on the affected parts. But, another way to perform it is changing the collation of the text by one insensitive. If you set the insesitiveCollation in the connection, the provided collate will be used instead of calling the `lower` function.

Providing the collation allows you to perform more advanced insensitive operations like case insensitive and accent insensitive, or even more in some languages (like manage some letter composition alternatives). Some databases offer general collations that are case insensitive and accent insensitive. But it is expected you want to use a collated specific for the language used by the user.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 
    insesitiveCollation = 'insensitive'
}
```

**Usefull collations per database**:

The following collations are case insensitive and accent insensitive:

- **PostgreSQL**: Starting from PostgreSQL 12 you can create custom non-deterministic collates from ICU database (previously it was OS dependant) with specific rules.
  - For a general collation case insensitive and accent insensitive, you create the collation using:
    ```sql
    CREATE COLLATION insensitive (
        provider = 'icu',
        locale = 'und@colStrength=primary', -- or 'und-u-ks-level1'
        deterministic = false
    )
    ```
  - For a collation specific for one language (in this example: Spanish) case insensitive and accent insensitive, you create the collation using:
    ```sql
    CREATE COLLATION es_insensitive (
        provider = 'icu',
        locale = 'es@colStrength=primary', -- or 'es-u-ks-level1'
        deterministic = false
    )
    ```
  - For more information, visit [this blog post](https://postgresql.verite.pro/blog/2019/10/14/nondeterministic-collations.html)
  - Execute `SELECT * FROM pg_collation` to list the already created collations
- **MySql**/**MariaDB**: 
  - `utf8_general_ci` for utf8 charset
  - `utf16_unicode_ci` for utf16 charset
  - `utf8_spanish_ci` for utf8 charset with spanish rules
  - Execute `SHOW COLLATION` to list the supported locations in your database; all locations ended with `_ci` are case insensitive and accent insensitive.
- **SqlServer**:
  - `Latin1_General_CI_AI` for a general case insensitive and accent insensitive for Latin alphabet-based languages
  - `Modern_Spanish_CI_AI` for a specific case insensitive and accent insensitive for the Spanish language only
  - Execute `SELECT * FROM sys.fn_helpcollations()` to list the supported locations in your database 
- **Oracle**:
  - `binary_ai` for a general case insensitive and accent insensitive for Latin alphabet-based languages
  - `spanish_m_ai` for a specific case insensitive and accent insensitive extended with the Spanish language rules
  - To see the collations list visit the [Oracle 11g](https://docs.oracle.com/cd/B28359_01/server.111/b28298/applocaledata.htm#i637232) or [Oracle 19](https://docs.oracle.com/en/database/oracle/oracle-database/19/nlspg/appendix-A-locale-data.html#GUID-CC85A33C-81FC-4E93-BAAB-1B3DB9036060) documentation webpage

**Note**: If you set the startWithInsensitive property to an empty string (''), the function `lower` will not be called, neither a collated will be specified. It is useful when you already defined the insensitive collate rules at the database level.

### Instantiating the connection with the database connection

```ts
const { Pool } = require('pg');
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool();

async function main() {
    const connection = new DBConection(new PgPoolQueryRunner(pool));
    // Do your queries here
    /*
     * Maybe you want to call:
     * await connection.beginTransaction();
     * await connection.commit();
     * await connection.rollback();
     */
}
```

**Important**: A ts-sql-query connection object represents a dedicated connection; consequently, don't share connections between requests when you are handling HTTP requests; create one connection object per request.

### Instantiating the connection with a mock database connection

Have a mock database connection is useful when you want to make unit tests. Using a mock connection allows you to test your code against the generated query instead of run the query in the database.

```ts
import { MockQueryRunner } from "ts-sql-query/queryRunners/MockQueryRunner";

function test('my db tets', () => {
    const connection = new DBConection(new MockQueryRunner(
        (type, query, params, index) => {
            switch (index) {
            case 0:
                expect(type).toBe('delete');
                expect(query).toBe('delete from customer where id = $1');
                expect(params).toEqual([10]);
                return 1; // Returns the result of the query execution
            default:
                throw new Error('Unexpected query');
            }
        }
    ));

    // Do your queries here, example:
    const deleteCustomer = connection.deleteFrom(tCustomer)
        .where(tCustomer.id.equals(10))
        .executeDelete();

    return deleteCustomer.then((result) => {
        expect(result).toBe(1);
    });
});
```

### Mapping the tables

In order to use the tables in queries, you need to map it in your system. To do it, you need to extend the table class that receives two generic arguments, the first one is the connection class, and the second one is a unique name for the table in your system.

```ts
import { Table } from "ts-sql-query/Table";

const tCompany = new class TCompany extends Table<DBConection, 'TCompany'> {
    id = this.autogeneratedPrimaryKey('id', 'int');
    name = this.column('name', 'string');
    constructor() {
        super('company'); // table name in the database
    }
}();

const tCustomer = new class TCustomer extends Table<DBConection, 'TCustomer'> {
    id = this.autogeneratedPrimaryKey('id', 'int');
    firstName = this.column('first_name', 'string');
    lastName = this.column('last_name', 'string');
    birthday = this.optionalColumn('birthday', 'localDate');
    companyId = this.column('company_id', 'int');
    constructor() {
        super('customer'); // table name in the database
    }
}();
```

**Important**: The constructor of a table must expect no arguments.

### Mapping the views

In order to use the views in queries, you need to map it in your system. To do it, you need to extend the view class that receives two generic arguments, the first one is the connection class, and the second one is a unique name for the view in your system.

```ts
import { View } from "ts-sql-query/View";

const vCustomerAndCompany = new class VCustomerAndCompany extends View<DBConection, 'VCustomerAndCompany'> {
    companyId = this.column('company_id', 'int');
    companyName = this.column('company_name', 'string');
    customerId = this.column('customer_id', 'int');
    customerFirstName = this.column('customer_first_name', 'string');
    customerLastName = this.column('customer_last_name', 'string');
    customerBirthday = this.optionalColumn('customer_birthday', 'localDate');
    constructor() {
        super('customer_company'); // view name in the database
    }
}();
```

**Important**: The constructor of a view must expect no arguments.

### Creating methods that allows to call a procedure

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 
    myOwnprocedure(param1: number) {
        return this.executeProcedure('myOwnprocedure', [this.const(param1, 'int')]);
    }
}
```

Executing the procedure:
```ts
const result = connection.myOwnprocedure(10);
```

The executed query is:
```sql
call myOwnprocedure($1)
```

The parameters are: `[ 10 ]`

The result type is a promise:
```ts
const result: Promise<void>
```

### Creating methods that allows to call a function

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 
    myOwnFunction(param1: number) {
        return this.executeFunction('myOwnFunction', [this.const(param1, 'int')], 'int', 'required');
    }
}
```

Executing the function:
```ts
const result = connection.myOwnFunction(10);
```

The executed query is:
```sql
select myOwnFunction($1)
```

The parameters are: `[ 10 ]`

The result type is a promise with the result returned by the function:
```ts
const result: Promise<number>
```

## Supported operations

The most common operations over the data are suported by ts-sql-query; in the case the database don't support it, an emulation is provided, if an emulation is not possible you will get an error during the compilation of your source code.

Some API are fluent API, that means, every function you call returns an object that contains the functions that you can call in that step. 

Here is shown a simplified version of the ts-sql-query APIs.

### Operations definitions

All values managed by the database are represented as a subclass of `ValueSource`, almost all methods listed here support the TypeScript value and the database value (as overload).

The methods which name ends with `IfValue` do the same that the one without `IfValue` but only if the provided value(s) are different to undefined, null, empty string (only when the allowEmptyString flag in the connection is not set to true, that is the default behaviour) or an empty array, otherwise it is ignored.

Be aware, in the database, when null is part of an operation the result of the operation is null (It is not represented in the following definition but it is implemented)

All the data manipulation operations are implemented as a methods inside the value, that means if you what to calculate the abolute, in sql is `abs(value)` but in ts-sql-query is reprecented as `value.abs()`.

```ts
interface ValueSource {
    isConstValue(): boolean
    /**
     * It returns the proper type of the value, instead of the any type included here to simplify
     * If the value source is not a const value it throws an error
     */
    getConstValue(): any
}

interface NullableValueSource extends ValueSource {
    isNull(): boolean
    isNotNull(): boolean
    valueWhenNull(value: this): this
    asOptional(): this | null | undefined
}

interface EqualableValueSource extends NullableValueSource {
    equalsIfValue(value: this | null | undefined): boolean
    equals(value: this): boolean
    notEqualsIfValue(value: this | null | undefined): boolean
    notEquals(value: this): boolean
    isIfValue(value: this | null | undefined): boolean
    /** 'is' is the same that equals, but returns true when booth are null */
    is(value: this): boolean
    isNotIfValue(value: this | null | undefined): boolean
    isNot(value: this): boolean

    inIfValue(values: this[] | null | undefined): boolean
    inIfValue(value: this | null | undefined): boolean
    in(values: this[]): boolean
    in(value: this): boolean
    in(select: Subquery): boolean
    notInIfValue(values: this[] | null | undefined): boolean
    notInIfValue(value: this | null | undefined): boolean
    notIn(values: this[]): boolean
    notIn(value: this): boolean
    notIn(select: Subquery): boolean
    inN(...value: this[]): boolean
    notInN(...value: this[]): boolean
}

interface ComparableValueSource extends EqualableValueSource {
    smallerIfValue(value: this | null | undefined): boolean
    smaller(value: this): boolean
    largerIfValue(value: this | null | undefined): boolean
    larger(value: this): boolean
    smallAsIfValue(value: this | null | undefined): boolean
    smallAs(value: this): boolean
    largeAsIfValue(value: this | null | undefined): boolean
    largeAs(value: this): boolean
    between(value: this, value2: this): boolean
    notBetween(value: this, value2: this): boolean
}

/**
 * Represents a boolean
 */
interface BooleanValueSource extends EqualableValueSource {
    negate(): boolean
    and(value: boolean): boolean
    or(value: boolean): boolean
}

/**
 * Represents an int or a double
 */
interface NumberValueSource extends ComparableValueSource {
    asInt(): number
    asDouble(): number
    asStringInt(): number|string
    asStringDouble(): number|string
    asBigint(): bigint
    abs(): number
    ceil(): number
    floor(): number
    round(): number
    exp(): number
    ln(): number
    log10(): number
    sqrt(): number
    cbrt(): number
    sign(): number
    acos(): number
    asin(): number
    atan(): number
    cos(): number
    cot(): number
    sin(): number
    tan(): number
    power(value: number): number
    logn(value: number): number
    roundn(value: number): number
    minValue(value: number): number
    maxValue(value: number): number
    add(value: number): number
    substract(value: number): number
    multiply(value: number): number
    divide(value: number): number
    mod(value: number): number
    atan2(value: number): number
}

/**
 * Represents a stringInt or a stringDouble
 */
interface StringNumberValueSource extends ComparableValueSource {
    asStringInt(): number|string
    asStringDouble(): number|string
    asBigint(): bigint
    abs(): number|string
    ceil(): number|string
    floor(): number|string
    round(): number|string
    exp(): number|string
    ln(): number|string
    log10(): number|string
    sqrt(): number|string
    cbrt(): number|string
    sign(): number|string
    acos(): number|string
    asin(): number|string
    atan(): number|string
    cos(): number|string
    cot(): number|string
    sin(): number|string
    tan(): number|string
    power(value: number|string): number|string
    logn(value: number|string): number|string
    roundn(value: number|string): number|string
    minValue(value: number|string): number|string
    maxValue(value: number|string): number|string
    add(value: number|string): number|string
    substract(value: number|string): number|string
    multiply(value: number|string): number|string
    divide(value: number|string): number|string
    mod(value: number|string): number|string
    atan2(value: number|string): number|string
}

/**
 * Represents a bigint
 */
interface BigintValueSource extends ComparableValueSource {
    asStringNumber(): number|string
    abs(): bigint
    ceil(): bigint
    floor(): bigint
    round(): bigint
    sign(): number
    minValue(value: bigint): bigint
    maxValue(value: bigint): bigint
    add(value: bigint): bigint
    substract(value: bigint): bigint
    multiply(value: bigint): bigint
    mod(value: bigint): bigint
}

/**
 * Represents a string
 */
interface StringValueSource extends ComparableValueSource {
    equalsInsensitiveIfValue(value: string | null | undefined): boolean
    equalsInsensitive(value: string): boolean
    notEqualsInsensitiveIfValue(value: string | null | undefined): boolean
    notEqualsInsensitive(value: string): boolean
    likeIfValue(value: string | null | undefined): boolean
    like(value: string): boolean
    notLikeIfValue(value: string | null | undefined): boolean
    notLike(value: string): boolean
    likeInsensitiveIfValue(value: string | null | undefined): boolean
    likeInsensitive(value: string): boolean
    notLikeInsensitiveIfValue(value: string | null | undefined): boolean
    notLikeInsensitive(value: string): boolean
    startWithIfValue(value: string | null | undefined): boolean
    startWith(value: string): boolean
    notStartWithIfValue(value: string | null | undefined): boolean
    notStartWith(value: string): boolean
    endWithIfValue(value: string | null | undefined): boolean
    endWith(value: string): boolean
    notEndWithIfValue(value: string | null | undefined): boolean
    notEndWith(value: string): boolean
    startWithInsensitiveIfValue(value: string | null | undefined): boolean
    startWithInsensitive(value: string): boolean
    notStartWithInsensitiveIfValue(value: string | null | undefined): boolean
    notStartWithInsensitive(value: string): boolean
    endWithInsensitiveIfValue(value: string | null | undefined): boolean
    endWithInsensitive(value: string): boolean
    notEndWithInsensitiveIfValue(value: string | null | undefined): boolean
    notEndWithInsensitive(value: string): boolean
    containsIfValue(value: string | null | undefined): boolean
    contains(value: string): boolean
    notContainsIfValue(value: string | null | undefined): boolean
    notContains(value: string): boolean
    containsInsensitiveIfValue(value: string | null | undefined): boolean
    containsInsensitive(value: string): boolean
    notContainsInsensitiveIfValue(value: string | null | undefined): boolean
    notContainsInsensitive(value: string): boolean
    lower(): string
    upper(): string
    length(): number
    trim(): string
    ltrim(): string
    rtrim(): string
    reverse(): string
    concatIfValue(value: string | null | undefined): string
    concat(value: string): string
    substringToEnd(start: number): string
    substring(start: number, end: number): string
    replaceIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): string
    replace(findString: string, replaceWith: string): string
}

/**
 * Represents a local date without time (using a Date object)
 */
interface DateValueSource extends ComparableValueSource {
    /** Gets the year */
    getFullYear(): number
    /** Gets the month (value between 0 to 11)*/
    getMonth(): number
    /** Gets the day-of-the-month */
    getDate(): number
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): number
}

/**
 * Represents a local time without date (using a Date object)
 */
interface TimeValueSource extends ComparableValueSource {
    /** Gets the hours */
    getHours(): number
    /** Gets the minutes */
    getMinutes(): number
    /** Gets the seconds */
    getSeconds(): number
    /** Gets the milliseconds */
    getMilliseconds(): number
}

/**
 * Represents a local date with time (using a Date object)
 */
interface DateTimeValueSource extends ComparableValueSource {
    /** Gets the year */
    getFullYear(): number
    /** Gets the month (value between 0 to 11)*/
    getMonth(): number
    /** Gets the day-of-the-month */
    getDate(): number
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): number
    /** Gets the hours */
    getHours(): number
    /** Gets the minutes */
    getMinutes(): number
    /** Gets the seconds */
    getSeconds(): number
    /** Gets the milliseconds */
    getMilliseconds(): number
    /** Gets the time value in milliseconds */
    getTime(): number
}
```

### Connection definition

```ts
interface Connection {
    /** Query runner used to create the connection */
    readonly queryRunner: QueryRunner

    // Transaction management
    beginTransaction(): Promise<void>
    commit(): Promise<void>
    rollback(): Promise<void>

    // Querying
    insertInto(table: Table): InsertExpression
    update(table: Table): UpdateExpression
    updateAllowingNoWhere(table: Table): UpdateExpression
    deleteFrom(table: Table): DeleteExpression
    deleteAllowingNoWhereFrom(table: Table): DeleteExpression
    selectFrom(table: Table | View): SelectExpression
    selectDistinctFrom(table: Table | View): SelectExpression
    selectFromNoTable(): SelectExpression

    // These methods allows to create a subquery that depends of a outer table defined in the main query 
    subSelectUsing(table: Table | View): SelectExpression
    subSelectUsing(table1: Table | View, table2: Table | View): SelectExpression
    subSelectUsing(table1: Table | View, table2: Table | View, table3: Table | View): SelectExpression
    subSelectDistinctUsing(table: Table | View): SelectExpression
    subSelectDistinctUsing(table1: Table | View, table2: Table | View): SelectExpression
    subSelectDistinctUsing(table1: Table | View, table2: Table | View, table3: Table | View): SelectExpression
    
    // default value for use in insert queries
    default(): Default

    // values that can be returned by the database
    pi(): NumberValueSource
    random(): NumberValueSource
    currentDate(): DateValueSource
    currentTime(): TimeValueSource
    currentDateTime(): DateTimeValueSource
    currentTimestamp(): DateTimeValueSource
    true(): BooleanValueSource
    false(): BooleanValueSource

    // methods that allows to create a value source with a constant value
    const(value: boolean, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    const(value: number | string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    const(value: number, type: 'int', adapter?: TypeAdapter): NumberValueSource
    const(value: number, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    const(value: number | string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    const(value: number, type: 'double', adapter?: TypeAdapter): NumberValueSource
    const(value: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    const(value: Date, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    const(value: Date, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    const(value: Date, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    const<T>(value: T, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    const<T>(value: T, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    const<T>(value: T, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource
    
    // allows to use the exits function on a subquery
    exists(select: Subquery): BooleanValueSource
    notExists(select: Subquery): BooleanValueSource

    // aggregate functions
    /** count(*) */
    countAll(): NumberValueSource
    /** count(value) */
    count(value: ValueSource): NumberValueSource
    /** count(distinct value) */
    countDistinct(value: ValueSource): NumberValueSource
    /** max(value) */
    max<TYPE extends ComparableValueSource>(value: TYPE): TYPE
    /** min(value) */
    min<TYPE extends ComparableValueSource>(value: TYPE): TYPE
    /** sum(value) */
    sum(value: NumberValueSource): NumberValueSource
    sum(value: StringNumberValueSource): StringNumberValueSource
    /** sum(distinct value) */
    sumDistinct(value: NumberValueSource): NumberValueSource
    sumDistinct(value: StringNumberValueSource): StringNumberValueSource
    /** avg(value) */
    average(value: NumberValueSource): NumberValueSource
    average(value: StringNumberValueSource): StringNumberValueSource
    /** avg(disctinct value) */
    averageDistinct(value: NumberValueSource): NumberValueSource
    averageDistinct(value: StringNumberValueSource): StringNumberValueSource
    /** group_concat(value, separator) sometimes called string_agg or listagg. The default separator is ',' */
    stringConcat(value: StringValueSource, separator?: string): StringValueSource
    /** group_concat(distinct value, separator) sometimes called string_agg or listagg. The default separator is ',' */
    stringConcatDistinct(value: StringValueSource, separator?: string): StringValueSource

    // Methods that allows create sql fragments
    fragmentWithType(type: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'stringInt', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'stringDouble', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T>(type: 'enum', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T>(type: 'custom', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T>(type: 'customComparable', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    
    // Protected methods that allows call a stored procedure
    executeProcedure(procedureName: string, params: ValueSource[]): Promise<void>

    // Protected methods that allows call a function
    executeFunction(functionName: string, params: ValueSource[], returnType: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<boolean>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'stringInt', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<number>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<number>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<bigint>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'stringDouble', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<number>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<number>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<string>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<Date>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<Date>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<Date>
    executeFunction<T>(functionName: string, params: ValueSource[], returnType: 'enum', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T>(functionName: string, params: ValueSource[], returnType: 'custom', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T>(functionName: string, params: ValueSource[], returnType: 'customComparable', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>

    // Protected methods to define a sequence (only available in oracle, postgreSql and sqlServer)
    sequence(name: string, type: 'boolean', adapter?: TypeAdapter): Sequence<BooleanValueSource>
    sequence(name: string, type: 'stringInt', adapter?: TypeAdapter): Sequence<StringNumberValueSource>
    sequence(name: string, type: 'int', adapter?: TypeAdapter): Sequence<NumberValueSource>
    sequence(name: string, type: 'bigint', adapter?: TypeAdapter): Sequence<BigintValueSource>
    sequence(name: string, type: 'stringDouble', adapter?: TypeAdapter): Sequence<StringNumberValueSource>
    sequence(name: string, type: 'double', adapter?: TypeAdapter): Sequence<NumberValueSource>
    sequence(name: string, type: 'string', adapter?: TypeAdapter): Sequence<StringValueSource>
    sequence(name: string, type: 'localDate', adapter?: TypeAdapter): Sequence<DateValueSource>
    sequence(name: string, type: 'localTime', adapter?: TypeAdapter): Sequence<TimeValueSource>
    sequence(name: string, type: 'localDateTime', adapter?: TypeAdapter): Sequence<DateTimeValueSource>
    sequence<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource>
    sequence<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource>
    sequence<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): Sequence<ComparableValueSource>

    // Protected methods to define reusable fragments
    /**
     * Allows to define arguments that acept the value or a value source of the type specified
     */
    arg(type: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    arg(type: 'stringInt', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    arg(type: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    arg(type: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    arg(type: 'stringDouble', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    arg(type: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    arg(type: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    arg(type: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    arg(type: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    arg(type: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    arg<T>(type: 'enum', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    arg<T>(type: 'custom', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    arg<T>(type: 'customComparable', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument

    /**
     * Allows to define arguments that acept the value (but no a value source) of the type specified
     */
    valueArg(type: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    valueArg(type: 'stringInt', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    valueArg(type: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    valueArg(type: 'bigint', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    valueArg(type: 'stringDouble', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    valueArg(type: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    valueArg(type: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    valueArg(type: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    valueArg(type: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    valueArg(type: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    valueArg<T>(type: 'enum', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    valueArg<T>(type: 'custom', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument
    valueArg<T>(type: 'customComparable', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Argument

    /*
     * This functions receive the argument definition that you can create calling the arg function or the valueArg function.
     * You can specify up to 5 argument definitions
     */
    buildFragmentWithArgs(...argumentDefinitions: Argument[]): FragmentBuilder
    buildFragmentWithArgsIfValue(...argumentDefinitions: Argument[]): FragmentBuilderIfValue

    /**
     * Return the same special boolean mark returned by the IfValue functions when there is no value
     */
    noValueBoolean(): BooleanValueSource

    /*
     * Configurations
     */

    /** 
     * Protected property that allows changing the behaviour of empty string treatment.
     * By default empty string as treated as null, if you want to allow to send and receive empty string to the database set this property to true
     * Default value: false
     */
    allowEmptyString: boolean

    /** Protected method that allows to transform the values received from the database */
    transformValueFromDB(value: unknown, type: string): unknown
    /** Protected method that allows to transform the values that will be send to the database */
    transformValueToDB(value: unknown, type: string): unknown

    /** Protected method that returns true if the provided string is a reserved keyword, otherwise return false */
    isReservedWord(word: string): boolean
    /** Protected method that returns the provided string as a indefier quoting it all the time */
    forceAsIdentifier(identifier: string): string
    /** 
     * Protected method that returns the provided identifier escaped.
     * The default implementation quote the identifier only if it is a reserved keyword.
     * If you want all identifiers quoted, you must reimplement this function returning the result of the forceAsIdentifier function.
     */
    escape(identifier: string): string
}

interface FragmentExpression {
    /** 
     * This is a template, you can call as: .sql`sql text with ${valueSourceParam}` 
     * You can specify up to 7 parameters.
     */
    sql(sql: TemplateStringsArray, ...p: ValueSource[]): ValueSource
}

interface FragmentBuilder {
    /*
     * The impl function will receive the proper ValueSource type according to the argument definition.
     * The nunber of arguments is the same specified in the function buildFragmentWithArgs (up to 5 arguments).
     * The arguments of the returned function will have the proper parameters type.
     */
    as(impl: (...args: ValueSource[]) => ValueSource): (...args: any) => ValueSource
}

interface FragmentBuilderIfValue {
    /*
     * The impl function will receive the proper ValueSource type according to the argument definition.
     * The nunber of arguments is the same specified in the function buildFragmentWithArgsIfValue (up to 5 arguments).
     * Any optional valueArg will be treated as required, the function received as argument will be not called if
     * that argument receives null or undefined.
     * The arguments of the returned function will have the proper parameters type.
     */
    as(impl: (...args: ValueSource[]) => ValueSource): (...args: any) => BooleanValueSource
}

interface Sequence<T> {
    nextValue(): T
    currentValue(): T
}
```

### Table definition

```ts
interface Table {
    /** Allows to define an alias for the table to be used in the selects queries */
    as(as: string): this
    /** Allows  to use the table in a left join */
    forUseInLeftJoin(): this & OuterJoinSource
    /** Allows  to use the table in a left join with an alias */
    forUseInLeftJoinAs(as: string): this & OuterJoinSource

    // Protected methods that allow to create a required column that doesn't admits null
    column(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    column(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    column(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    column(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    column(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    column(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    column(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    column(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    column<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    column<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    column<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource

    // Protected methods that allow to create an optional column that admits null
    optionalColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalColumn(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    optionalColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalColumn(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    optionalColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalColumn(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    optionalColumn(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    optionalColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    optionalColumn<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    optionalColumn<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    optionalColumn<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource
    
    // Protected methods that allow to create a required column that doesn't admits null but have a default value when insert
    columnWithDefaultValue(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    columnWithDefaultValue(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    columnWithDefaultValue(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    columnWithDefaultValue(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    columnWithDefaultValue(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    columnWithDefaultValue(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    columnWithDefaultValue(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    columnWithDefaultValue(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    columnWithDefaultValue(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    columnWithDefaultValue(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    columnWithDefaultValue<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    columnWithDefaultValue<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    columnWithDefaultValue<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource
    
    // Protected methods that allow to create an optional column that admits null and have a default value when insert
    optionalColumnWithDefaultValue(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalColumnWithDefaultValue(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    optionalColumnWithDefaultValue(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalColumnWithDefaultValue(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalColumnWithDefaultValue(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    optionalColumnWithDefaultValue(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalColumnWithDefaultValue(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalColumnWithDefaultValue(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    optionalColumnWithDefaultValue(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    optionalColumnWithDefaultValue(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    optionalColumnWithDefaultValue<T>(name: string, type: 'enum', typeNme: string, adapter?: TypeAdapter): EqualableValueSource
    optionalColumnWithDefaultValue<T>(name: string, type: 'custom', typeNme: string, adapter?: TypeAdapter): EqualableValueSource
    optionalColumnWithDefaultValue<T>(name: string, type: 'customComparable', typeNme: string, adapter?: TypeAdapter): ComparableValueSource
    
    // Protected methods that allow to create a primary key column autogenerated in the database
    // When you insert you don't need specify this column
    autogeneratedPrimaryKey(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    autogeneratedPrimaryKey(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    autogeneratedPrimaryKey(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKey(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    autogeneratedPrimaryKey(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    autogeneratedPrimaryKey(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKey(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    autogeneratedPrimaryKey(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    autogeneratedPrimaryKey(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    autogeneratedPrimaryKey(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    autogeneratedPrimaryKey<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    autogeneratedPrimaryKey<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    autogeneratedPrimaryKey<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource

    // Protected methods that allow to create a primary key column not automatically generated
    // When you insert you must specify this column
    primaryKey(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    primaryKey(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    primaryKey(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    primaryKey(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    primaryKey(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    primaryKey(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    primaryKey(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    primaryKey(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    primaryKey(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    primaryKey(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    primaryKey<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    primaryKey<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    primaryKey<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource
      
    // Protected methods that allow to create a primary key column generated by a sequence
    // When you insert you don't need specify this column, it will be added automatically by ts-sql-query
    // This method is only supported by oracle, postgreSql and sqlServer
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    autogeneratedPrimaryKeyBySequence<T>(name: string, sequenceName: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    autogeneratedPrimaryKeyBySequence<T>(name: string, sequenceName: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    autogeneratedPrimaryKeyBySequence<T>(name: string, sequenceName: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource

    // Protected methods that allow to create a computed column that doesn't admits null
    computedColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    computedColumn(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    computedColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    computedColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    computedColumn(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    computedColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    computedColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    computedColumn(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    computedColumn(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    computedColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    computedColumn<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    computedColumn<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    computedColumn<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource

    // Protected methods that allow to create an optional computed column that admits null
    optionalComputedColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalComputedColumn(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    optionalComputedColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalComputedColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalComputedColumn(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    optionalComputedColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalComputedColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalComputedColumn(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    optionalComputedColumn(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    optionalComputedColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    optionalComputedColumn<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    optionalComputedColumn<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    optionalComputedColumn<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource
}
```

### View definition

```ts
interface View {
    /** Allows to define an alias for the view to be used in the selects queries */
    as(as: string): this
    /** Allows  to use the view in a left join */
    forUseInLeftJoin(): this & OuterJoinSource
    /** Allows  to use the view in a left join with an alias */
    forUseInLeftJoinAs(as: string): this & OuterJoinSource

    // Protected methods that allow to create a required column that doesn't admits null
    column(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    column(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    column(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    column(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    column(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    column(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    column(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    column(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    column<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    column<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    column<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource

    // Protected methods that allow to create an optional column that admits null
    optionalColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalColumn(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    optionalColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource
    optionalColumn(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    optionalColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalColumn(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    optionalColumn(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    optionalColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    optionalColumn<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    optionalColumn<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    optionalColumn<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource
}
```

### Insert definition

```ts
interface InsertExpression {
    /** Alias to set method: Set the values for insert */
    values(columns: InsertSets): this
    /** Allow to insert multiple registers in the database */
    values(columns: InsertSets[]): this
    /** Set the values for insert */
    set(columns: InsertSets): this
    /** 
     * Set a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setIfValue(columns: OptionalInsertSets): this
    /** Set a previous set value only */
    setIfSet(columns: InsertSets): this
    /** 
     * Set a previous set value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setIfSetIfValue(columns: OptionalInsertSets): this
    /** Set a unset value (only if the value was not previously set) */
    setIfNotSet(columns: InsertSets): this
    /** 
     * Set a unset value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     * (only if the value was not previously set) 
     */
    setIfNotSetIfValue(columns: OptionalInsertSets): this
    /** Unset the listed columns previous set */
    ignoreIfSet(...columns: string[]): this
    /** Allows to set the values dynamically */
    dynamicSet(): this

    /** Insert the default values in the table */
    defaultValues(): this

    /** Insert from a select */
    from(select: Subquery): this

    /** 
     * Indicate that the query must return the last inserted id 
     * Note: If you are inserting multiple rows, only PostgreSql, SqlServer and Oracle support it
     */
    returningLastInsertedId(): this

    /** Execute the insert, by default returns the number of inserted rows*/
    executeInsert(): Promise<RESULT>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]
}

/** Columns required by the insert */
type InsertSets = { [columnName: string]: any }
/** Columns required by the insert, but marked as optionals */
type OptionalInsertSets = { [columnName: string]: any }
```

### Update definition

```ts
interface UpdateExpression {
    /** Set the values for insert */
    set(columns: InsertSets): this
    /** Set a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setIfValue(columns: OptionalInsertSets): this
    /** Set a previous set value only */
    setIfSet(columns: InsertSets): this
    /** Set a previous set value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     */
    setIfSetIfValue(columns: OptionalInsertSets): this
    /** Set a unset value (only if the value was not previously set) */
    setIfNotSet(columns: InsertSets): this
    /** 
     * Set a unset value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     * (only if the value was not previously set) 
     */
    setIfNotSetIfValue(columns: OptionalInsertSets): this
    /** Unset the listed columns previous set */
    ignoreIfSet(...columns: string[]): this
    /** Allows to set the values dynamically */
    dynamicSet(): this

    /** Allows to create the where dynamically */
    dynamicWhere(): this
    /** Allows to specify the where */
    where(condition: BooleanValueSource): this

    /** Allows to extends the where using an and */
    and(condition: BooleanValueSource): this
    /** Allows to extends the where using an or */
    or(condition: BooleanValueSource): this

    /**
     * Execute the update returning the number of updated rows
     * 
     * @param min Indicate the minimum of rows that must be updated, 
     *           if the minimum is not reached an exception will be thrown
     * @param max Indicate the maximum of rows that must be updated, 
     *           if the maximum is exceeded an exception will be thrown
     */
    executeUpdate(min?: number, max?: number): Promise<number>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]
}

/** Columns required by the update */
type UpdateSets = { [columnName: string]: any }
/** Columns required by the update, but marked as optional */
type OptionalUpdateSets = { [columnName: string]: any }
```

### Delete definition

```ts
interface DeleteExpression {
    /** Allows to create the where dynamically */
    dynamicWhere(): this
    /** Allows to specify the where */
    where(condition: BooleanValueSource): this

    /** Allows to extends the where using an and */
    and(condition: BooleanValueSource): this
    /** Allows to extends the where using an or */
    or(condition: BooleanValueSource): this

    /**
    * Execute the delete returning the number of deleted rows
    * 
    * @param min Indicate the minimum of rows that must be deleted, 
    *           if the minimum is not reached an exception will be thrown
    * @param max Indicate the maximum of rows that must be deleted, 
    *           if the maximum is exceeded an exception will be thrown
    */
    executeDelete(min?: number, max?: number): Promise<number>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]
}
```

### Select definition

The select query definition must follow the logical order or the alternative order:
- **Logical order**: from, join, where, group by, having, select, limit, offset
- **Alternative order**: from, join, select, where, group by, having, limit, offset

```ts
interface SelectExpression {
    /** Allows to add a from to the select query */
    from(table: Table | View): this

    /** Allows to add a join to the select query */
    join(table: Table | View): this
    /** Allows to add a inner join to the select query */
    innerJoin(table: Table | View): this
    /** 
     * Allows to add a left join to the select query. 
     * Note: to use a table or view here you must call first forUseInLeftJoin methods on it
     */
    leftJoin(source: OuterJoinSource): this
    /** 
     * Allows to add a left outer join to the select query. 
     * Note: to use a table or view here you must call first forUseInLeftJoin methods on it
     */
    leftOuterJoin(source: OuterJoinSource): this

    /** Allows to create the on clause of a join dynamically */
    dynamicOn(): this
    /** Allows to specify the on clause of a join */
    on(condition: BooleanValueSource): this

    /** Allows to create the where dynamically */
    dynamicWhere(): this
    /** Allows to specify the where */
    where(condition: BooleanValueSource): this
    
    /** Allows to specify the group by of the select query */
    groupBy(...columns: ValueSource[]): this
    /** 
     * Allows to specify the group by of the select query.
     * 
     * If you already defined the select clause, you can use the name of
     * the properties returned by the select instead of its definition, it
     * will be replace by the definition automatically.
     * 
     * Note: this overload is only available if you define the select clause first.
     */
    groupBy(...columns: string[]): this
    /** Allows to create the having clause of the group by dynamically */
    dynamicHaving(): this
    /** Allows to specify the having clause of the group by */
    having(condition: BooleanValueSource): this

    /** 
     * Allows to specify the select clause.
     * It must be an object where the name of the property is the name of the resulting property
     * and the value is the ValueSource where the value will be obtained.
     */
    select(columns: SelectValues): this
    /** 
     * Allows to specify the select clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    selectOneColumn(column: ValueSource): this

    /** 
     * Allows to specify an order by used by the query, you must indicate the name of the column
     * returned by the query.
     * If you select one column the name of the column is 'result'.
     */
    orderBy(column: string, mode?: OrderByMode): this
    /** Allows to specify an order by dynamically, it is parsed from the provided string */
    orderByFromString(orderBy: string): this

    /** Allows to specify the maximum number of rows that will be returned by the query */
    limit(limit: number): this
     /** Allows to specify the number of first rows ignored by the query */
    offset(offset: number): this


    /** Allows to extends the where, or the on clause of a join, or the having clause using an and */
    and(condition: BooleanValueSource): this
    /** Allows to extends the where, or the on clause of a join, or the having clause using an or */
    or(condition: BooleanValueSource): this

    /** Execute the select query that returns one o no result from the database */
    executeSelectNoneOrOne(): Promise<RESULT | null>
    /** 
     * Execute the select query that returns one result from the database.
     * If no result is returned by the database an exception will be thrown.
     */
    executeSelectOne(): Promise<RESULT>
    /** Execute the select query that returns zero or many results from the database */
    executeSelectMany(): Promise<RESULT[]>
    /** 
     * Execute the select query that returns zero or many results from the database.
     * Select page execute the query twice, the first one to get the data from the database 
     * and the second one to get the count of all data without the limit and the offset. 
     * Note: select page is only available if you don't define a group by clause.
     */
    executeSelectPage(): Promise<{ data: RESULT[], count: number }>
    /** 
     * Execute the select query as a select page, but allows to include extra properties to will be resulting object.
     * If the object provided by argument includes the property count, the query that count the data will be omitted and
     * this value will be used. If the object provided by argument includes the property data, the query that extract 
     * the data will be omitted and this value will be used.
     */
    executeSelectPage<EXTRAS extends {}>(extras: EXTRAS): Promise<{ data: RESULT[], count: number } & EXTRAS>
    
    /**
     * Allows to use a select query as a view in another select. 
     * This select will be included as a clause with in the final sql.
     * 
     * @param as name of the clause with in the final query (must be unique per final query)
     */
    forUseInQueryAs(as: string): View
    
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]
}

/**
 * Modes of sorting in an order by.
 * If the database don't support one of then it will be emulated.
 */
type OrderByMode = 'asc' | 'desc' | 'asc nulls first' | 'asc nulls last' | 'desc nulls first' | 'desc nulls last' | 'insensitive' |
                   'asc insensitive' | 'desc insensitive' | 'asc nulls first insensitive' | 'asc nulls last insensitive' | 
                   'desc nulls first insensitive' | 'desc nulls last insensitive'

/**
 * Select projection of the value that vill be retreived from the database.
 * 
 * It must be an object where the name of the property is the name of the resulting property
 * and the value is the ValueSource where the value will be obtained.
 */
type SelectValues = { [columnName: string]: ValueSource }
```

### Type adpaters

Type adapters allow customising how the values are sent and recovered from the database allowing transform them. You can specify the type adapter per field when you define at the table or view; or, you can define general rules overriding the `transformValueFromDB` and `transformValueToDB`.

The `CustomBooleanTypeAdapter` allows defining custom values to express a boolean when they don't match the database's default values. For example, when you have a field in the database that is a boolean; but, the true value is represented with the string `yes`, and the false value is represented with the string `no`. See [Custom booleans values](#custom-booleans-values) for more information.

Type adapter definitions are in the file `ts-sql-query/TypeAdapter`.

```ts
interface TypeAdapter {
    transformValueFromDB(value: any, type: string, next: DefaultTypeAdapter): any
    transformValueToDB(value: any, type: string, next: DefaultTypeAdapter): any
}

interface DefaultTypeAdapter {
    transformValueFromDB(value: any, type: string): any
    transformValueToDB(value: any, type: string): any
}

class CustomBooleanTypeAdapter implements TypeAdapter {
    readonly trueValue: number | string
    readonly falseValue: number | string

    constructor(trueValue: number, falseValue: number)
    constructor(trueValue: string, falseValue: string)

    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown
}
```

## Supported databases

The way to define what database to use is when you define the connection and extends the proper database connection. You need to choose the proper database in order to generate the queries in the sql dialect handled by that database.

### MariaDB

```ts
import { MariaDBConnection } from "ts-sql-query/connections/MariaDBConnection";

class DBConection extends MariaDBConnection<'DBConnection'> { }
```

### MySql

```ts
import { MySqlConnection } from "ts-sql-query/connections/MySqlConnection";

class DBConection extends MySqlConnection<'DBConnection'> { }
```

### Oracle

```ts
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConection extends OracleConnection<'DBConnection'> { }
```

**Note**: Oracle doesn't have boolean data type; ts-sql-query assumes that the boolean is represented by a number where `0` is false, and `1` is true. All conversions are made automatically by ts-sql-query. In case you need a different way to represent a boolean, see [Custom booleans values](#custom-booleans-values) for more information.

### PostgreSql

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { }
```

### Sqlite

```ts
import { SqliteConnection } from "ts-sql-query/connections/SqliteConnection";

class DBConection extends SqliteConnection<'DBConnection'> { }
```

**Note**: If you use [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) to connect to the database you can run your queries synchronously. See [BetterSqlite3QueryRunner](#better-sqlite3) and [Synchronous query runners](#synchronous-query-runners) for more information.

### SqlServer

```ts
import { SqlServerConnection } from "ts-sql-query/connections/SqlServerConnection";

class DBConection extends SqlServerConnection<'DBConnection'> { }
```

**Note**: An empty string will be treated as a null value; if you need to allow empty string set the allowEmptyString property to true in the connection object.

**Note**: Sql Server doesn't have boolean data type; ts-sql-query assumes that the boolean is represented by a bit where `0` is false, and `1` is true. All conversions are made automatically by ts-sql-query. In case you need a different way to represent a boolean, see [Custom booleans values](#custom-booleans-values) for more information.

## Supported databases with extended ts types

If you uses this variant, the types defined in [ts-extended-types](https://www.npmjs.com/package/ts-extended-types). It types allows to make your application even more type-safe and represents better the data handled by the database.

### MariaDB

```ts
import { TypeSafeMariaDBConnection } from "ts-sql-query/connections/TypeSafeMariaDBConnection";

class DBConection extends TypeSafeMariaDBConnection<'DBConnection'> { }
```

### MySql

```ts
import { TypeSafeMySqlConnection } from "ts-sql-query/connections/TypeSafeMySqlConnection";

class DBConection extends TypeSafeMySqlConnection<'DBConnection'> { }
```

### Oracle

```ts
import { TypeSafeOracleConnection } from "ts-sql-query/connections/TypeSafeOracleConnection";

class DBConection extends TypeSafeOracleConnection<'DBConnection'> { }
```

**Note**: Oracle doesn't have boolean data type; ts-sql-query assumes that the boolean is represented by a number where `0` is false, and `1` is true. All conversions are made automatically by ts-sql-query. In case you need a different way to represent a boolean, see [Custom booleans values](#custom-booleans-values) for more information.

### PostgreSql

```ts
import { TypeSafePostgreSqlConnection } from "ts-sql-query/connections/TypeSafePostgreSqlConnection";

class DBConection extends TypeSafePostgreSqlConnection<'DBConnection'> { }
```

### Sqlite

```ts
import { TypeSafeSqliteConnection } from "ts-sql-query/connections/TypeSafeSqliteConnection";

class DBConection extends TypeSafeSqliteConnection<'DBConnection'> { }
```

**Note**: If you use [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) to connect to the database you can run your queries synchronously. See [BetterSqlite3QueryRunner](#better-sqlite3) and [Synchronous query runners](#synchronous-query-runners) for more information.

### SqlServer

```ts
import { TypeSafeSqlServerConnection } from "ts-sql-query/connections/TypeSafeSqlServerConnection";

class DBConection extends TypeSafeSqlServerConnection<'DBConnection'> { }
```

**Note**: An empty string will be treated as a null value; if you need to allow empty string set the allowEmptyString property to true in the connection object.

**Note**: Sql Server doesn't have boolean data type; ts-sql-query assumes that the boolean is represented by a bit where `0` is false, and `1` is true. All conversions are made automatically by ts-sql-query. In case you need a different way to represent a boolean, see [Custom booleans values](#custom-booleans-values) for more information.

## Query runners

### any-db (with connection pool)

It allows to execute the queries using an [any-db](https://www.npmjs.com/package/any-db) connection pool. To use this query runner you need to install as well [any-db-transaction](https://www.npmjs.com/package/any-db-transaction).

**Supported databases**: mariaDB, mySql, postgreSql, sqlite, sqlServer

It internally uses:
- [tedious](https://www.npmjs.com/package/tedious) for connections to SqlServer
- [mysql](https://www.npmjs.com/package/mysql) for connections to MariaDB and MySql. It is not working properly due the bug https://github.com/Hypermediaisobar-admin/node-any-db-mssql/issues/1
- [pg](https://www.npmjs.com/package/pg) for connections to PostgreSql
- [sqlite3](https://www.npmjs.com/package/sqlite3) for connections to SqlLite. It is not working properly due the bug https://github.com/grncdr/node-any-db/issues/83

**Note**: All of these implementations have a direct implementation here as alternative.

```ts
import { createPool } from 'any-db'
import { AnyDBPoolQueryRunner } from "ts-sql-query/queryRunners/AnyDBPoolQueryRunner";

const pool = createPool('postgres://user:pass@localhost/dbname', {
  min: 5,
  max: 15
});

async function main() {
    const connection = new DBConection(new AnyDBPoolQueryRunner(pool));
    // Do your queries here
}
```

### any-db (with connection)

It allows to execute the queries using an [any-db](https://www.npmjs.com/package/any-db) connection. To use this query runner you need to install as well [any-db-transaction](https://www.npmjs.com/package/any-db-transaction).

**Supported databases**: mariaDB, mySql, postgreSql, sqlite, sqlServer

It internally uses:
- [tedious](https://www.npmjs.com/package/tedious) for connections to SqlServer
- [mysql](https://www.npmjs.com/package/mysql) for connections to MariaDB and MySql. It is not working properly due the bug https://github.com/Hypermediaisobar-admin/node-any-db-mssql/issues/1
- [pg](https://www.npmjs.com/package/pg) for connections to PostgreSql
- [sqlite3](https://www.npmjs.com/package/sqlite3) for connections to SqlLite. It is not working properly due the bug https://github.com/grncdr/node-any-db/issues/83

**Note**: All of these implementations have a direct implementation here as alternative.

```ts
import { createPool } from 'any-db'
import { AnyDBQueryRunner } from "ts-sql-query/queryRunners/AnyDBQueryRunner";

const pool = createPool('postgres://user:pass@localhost/dbname', {
  min: 5,
  max: 15
});

function main() {
    pool.acquire((error, anyDBConnection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConection(new AnyDBQueryRunner(anyDBConnection));
            doYourLogic(connection).finally(() => {
                pool.release(anyDBConnection);
            });
        } catch(e) {
            pool.release(anyDBConnection);
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConection) {
     // Do your queries here
}
```

### better-sqlite3

It allows to execute the queries using a [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) connection.

**Supported databases**: sqlite

```ts
import { BetterSqlite3QueryRunner } from "ts-sql-query/queryRunners/BetterSqlite3QueryRunner";
import * as betterSqlite3 from "better-sqlite3";

const db = betterSqlite3('foobar.db', options);

async function main() {
    const connection = new DBConection(new BetterSqlite3QueryRunner(db));
    // Do your queries here
}
```

**Note**: better-sqlite3 supports synchronous query execution. See [Synchronous query runners](#synchronous-query-runners) for more information.

### ConsoleLogNoopQueryRunner

A fake connections that write all the queries to the standard output using `console.log` and returns an empty result.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { ConsoleLogNoopQueryRunner } from "ts-sql-query/queryRunners/ConsoleLogNoopQueryRunner";

async function main() {
    const connection = new DBConection(new ConsoleLogNoopQueryRunner());
    // Do your queries here
}
```

**Note**: `ConsoleLogNoopQueryRunner` supports synchronous query execution. See [Synchronous query runners](#synchronous-query-runners) for more information.

### ConsoleLogQueryRunner

A query runner that write all the queries to the standard output using `console.log` and delegate the execution of the queries to the query runner received as argument in the constructor.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { ConsoleLogQueryRunner } from "ts-sql-query/queryRunners/ConsoleLogQueryRunner";

async function main() {
    const connection = new DBConection(new ConsoleLogQueryRunner(otherQueryRunner));
    // Do your queries here
}
```

### LoopBack DataSource

It allows to execute the queries using a [LoopBack](https://loopback.io/) data source.

**Supported databases**: mariaDB, mySql, postgreSql, sqlite, sqlServer, oracle

It internally uses:
- [mysql](https://www.npmjs.com/package/mysql) for connections to MariaDB and MySql.
- [pg](https://www.npmjs.com/package/pg) for connections to PostgreSql.
- [sqlite3](https://www.npmjs.com/package/sqlite3) for connections to SqlLite.
- [tedious](https://www.npmjs.com/package/tedious) for connections to SqlServer.
- [oracledb](https://www.npmjs.com/package/oracledb) for connections to Oracle.

**Note**: All of these implementations have a direct implementation here as alternative.

**Only the following connectors are supported**:
- **mysql**, using `loopback-connector-mysql` package
- **postgresql**, using `loopback-connector-postgresql` package
- **sqlite3**, using `loopback-connector-sqlite3` package
- **mssql**, using `loopback-connector-mssql` package
- **oracle**, using `loopback-connector-oracle` package

```ts
import {juggler} from '@loopback/repository';
import { createLoopBackQueryRunner } from "ts-sql-query/queryRunners/LoopBackQueryRunner";

const db = new juggler.DataSource({
    name: 'db',
    connector: "postgresql",
    host: 'localhost',
    port: 5432,
    database: 'dbname',
    user: 'user',
    password: 'pass'
});

async function main() {
    const connection = new DBConection(createLoopBackQueryRunner(db));
    // Do your queries here
}
```

### mariadb (with a connection pool)

It allows to execute the queries using a [mariadb](https://www.npmjs.com/package/mariadb) connection pool.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mariadb";
import { MariaDBPoolQueryRunner } from "ts-sql-query/queryRunners/MariaDBPoolQueryRunner";

const pool = createPool({
    host: 'mydb.com', 
    user: 'myUser', 
    password: 'myPwd',
    database: 'myDB',
    connectionLimit: 5
});

async function main() {
    const connection = new DBConection(new MariaDBPoolQueryRunner(pool));
    // Do your queries here
}
```

### mariadb (with a connection)

It allows to execute the queries using a [mariadb](https://www.npmjs.com/package/mariadb) connection.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mariadb";
import { MariaDBQueryRunner } from "ts-sql-query/queryRunners/MariaDBQueryRunner";

const pool = createPool({
    host: 'mydb.com', 
    user: 'myUser', 
    password: 'myPwd',
    database: 'myDB',
    connectionLimit: 5
});

async function main() {
    const mariaDBConnection = await pool.getConnection();
    try {
        const connection = new DBConection(new MariaDBQueryRunner(mariaDBConnection));
        // Do your queries here
    } finally {
        mariaDBConnection.release();
    }
}
```

### MockQueryRunner

Mock connection that allows you inspect the queries and return the desired value as result of the query execution.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { MockQueryRunner } from "ts-sql-query/queryRunners/MockQueryRunner";

async function main() {
    const connection = new DBConection(new MockQueryRunner(
        (type, query, params, index) => {
            // verify your queries here
        }
    ));

    // Do your queries here
}
```

The `MockQueryRunner` receives a function as argument to the constructor, this function returns the result of the query execution and receive as argument:
- **`type: QueryType`**: type of the query to be executed. The `QueryType` is defined as:

    ```ts
    type QueryType = 'selectOneRow' | 'selectManyRows' | 'selectOneColumnOneRow' | 'selectOneColumnManyRows' | 
    'insert' | 'insertReturningLastInsertedId' | 'insertReturningMultipleLastInsertedId' | 'update' | 'delete' | 
    'executeProcedure' | 'executeFunction' | 
    'beginTransaction' | 'commit' | 'rollback' |
    'executeDatabaseSchemaModification'
    ```

- **`query: string`**: query required to be executed
- **`params: any[]`**: parameters received by the query
- **`index: number`**: this is a counter of queries executed by the connection; that means, when the first query is executed the value is 0, when the second query is executed the value is 1, etc.

**Note**: `MockQueryRunner` supports synchronous query execution. See [Synchronous query runners](#synchronous-query-runners) for more information.

### msnodesqlv8

It allows to execute the queries using an [msnodesqlv8](https://www.npmjs.com/package/msnodesqlv8) connection.

**Supported databases**: sqlServer (only on Windows)

**Note**: If you are going to use msnodesqlv8, please, let me know.

```ts
const sql = require("msnodesqlv8");
import { MsNodeSqlV8QueryRunner } from "ts-sql-query/queryRunners/MsNodeSqlV8QueryRunner";

const connectionString = "server=.;Database=Master;Trusted_Connection=Yes;Driver={SQL Server Native Client 11.0}";

// Note: this code doesn't create a pool, maybe you want one

function main() {
    sql.open(connectionString, function (error, sqlServerConnection) {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConection(new MsNodeSqlV8QueryRunner(sqlServerConnection));
            yourLogic(connection).finally(() => {
                sqlServerConnection.close((closeError) => {
                    throw closeError;
                });
            });
        } catch(e) {
            sqlServerConnection.close((closeError) => {
                throw closeError;
            });
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConection) {
     // Do your queries here
}
```

### mssql (with a connection pool promise)

It allows to execute the queries using a [mssql](https://www.npmjs.com/package/mssql) connection pool promise.

**Supported databases**: sqlServer

It internally uses:
- [tedious](https://www.npmjs.com/package/tedious) for connections to SqlServer on any OS
- [msnodesqlv8](https://www.npmjs.com/package/msnodesqlv8) for connections to SqlServer only on Windows

**Note**: All of these implementations have a direct implementation here as alternative.

```ts
import { ConnectionPool } from 'mssql'
import { MssqlPoolPromiseQueryRunner } from "./queryRunners/MssqlPoolPromiseQueryRunner";

const poolPromise = new ConnectionPool({
    user: '...',
    password: '...',
    server: 'localhost',
    database: '...'
}).connect();

async function main() {
    const connection = new DBConection(new MssqlPoolPromiseQueryRunner(poolPromise));
    // Do your queries here
}
```

### mssql (with a connection pool)

It allows to execute the queries using a [mssql](https://www.npmjs.com/package/mssql) connection pool.

**Supported databases**: sqlServer

It internally uses:
- [tedious](https://www.npmjs.com/package/tedious) for connections to SqlServer on any OS
- [msnodesqlv8](https://www.npmjs.com/package/msnodesqlv8) for connections to SqlServer only on Windows

**Note**: All of these implementations have a direct implementation here as alternative.

```ts
import { ConnectionPool } from 'mssql'
import { MssqlPoolQueryRunner } from "./queryRunners/MssqlPoolQueryRunner";

const poolPromise = new ConnectionPool({
    user: '...',
    password: '...',
    server: 'localhost',
    database: '...'
}).connect();

async function main() {
    const mssqlPool = await poolPromise;
    const connection = new DBConection(new MssqlPoolQueryRunner(mssqlPool));
    // Do your queries here
}
```

### mysql (with a connection pool)

It allows to execute the queries using a [mysql](https://www.npmjs.com/package/mysql) connection pool.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mysql";
import { MySqlPoolQueryRunner } from "ts-sql-query/queryRunners/MySqlPoolQueryRunner";

const pool  = createPool({
  connectionLimit : 10,
  host            : 'example.org',
  user            : 'bob',
  password        : 'secret',
  database        : 'my_db'
});

async function main() {
    const connection = new DBConection(new MySqlPoolQueryRunner(pool));
    // Do your queries here
}
```

### mysql (with a connection)

It allows to execute the queries using a [mysql](https://www.npmjs.com/package/mysql) connection.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mysql";
import { MySqlQueryRunner } from "ts-sql-query/queryRunners/MySqlQueryRunner";

const pool  = createPool({
  connectionLimit : 10,
  host            : 'example.org',
  user            : 'bob',
  password        : 'secret',
  database        : 'my_db'
});

function main() {
    pool.getConnection((error, mysqlConnection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConection(new MySqlQueryRunner(mysqlConnection));
            doYourLogic(connection).finnaly(() => {
                mysqlConnection.release();
            });
        } catch(e) {
            mysqlConnection.release();
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConection) {
    // Do your queries here
}
```

### mysql2 (with a connection pool)

It allows to execute the queries using a [mysql2](https://www.npmjs.com/package/mysql2) connection pool.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mysql2";
import { MySql2PoolQueryRunner } from "ts-sql-query/queryRunners/MySql2PoolQueryRunner";

const pool = createPool({
  host: 'localhost',
  user: 'user',
  password: 'secret',
  database: 'test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function main() {
    const connection = new DBConection(new MySql2PoolQueryRunner(pool));
    // Do your queries here
}
```

### mysql2 (with a connection)

It allows to execute the queries using a [mysql2](https://www.npmjs.com/package/mysql2) connection.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mysql2";
import { MySql2QueryRunner } from "ts-sql-query/queryRunners/MySql2QueryRunner";

const pool = createPool({
  host: 'localhost',
  user: 'user',
  password: 'secret',
  database: 'test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function main() {
    pool.getConnection((error, mysql2Connection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConection(new MySql2QueryRunner(mysql2Connection));
            doYourLogic(connection).finnaly(() => {
                mysql2Connection.release();
            });
        } catch(e) {
            mysql2Connection.release();
            throw e;
        }
    });
}

async doYourLogic(connection: DBConection) {
    // Do your queries here
}
```

### NoopQueryRunner

A fake connections that returns an empty result.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { NoopQueryRunner } from "ts-sql-query/queryRunners/NoopQueryRunner";

async function main() {
    const connection = new DBConection(new NoopQueryRunner());
    // Do your queries here
}
```

**Note**: `NoopQueryRunner` supports synchronous query execution. See [Synchronous query runners](#synchronous-query-runners) for more information.

### oracledb (with a connection pool promise)

It allows to execute the queries using an [oracledb](https://www.npmjs.com/package/oracledb) connection pool promise.

**Supported databases**: oracle

```ts
import { createPool } from 'oracledb';
import { OracleDBPoolPromiseQueryRunner } from "ts-sql-query/queryRunners/OracleDBPoolPromiseQueryRunner";

const poolPromise = createPool({
    user: 'user',
    password: 'pwd',
    connectString: 'localhost/XEPDB1'
});

async function closePoolAndExit() {
    try {
        const pool = await poolPromise;
        await pool.close(10);
        process.exit(0);
    } catch(err) {
        process.exit(1);
    }
}

process
  .once('SIGTERM', closePoolAndExit)
  .once('SIGINT',  closePoolAndExit)
  .once('beforeExit',  closePoolAndExit);

async function main() {
    const connection = new DBConection(new OracleDBPoolPromiseQueryRunner(poolPromise));
    // Do your queries here
}
```

### oracledb (with a connection pool)

It allows to execute the queries using an [oracledb](https://www.npmjs.com/package/oracledb) connection pool.

**Supported databases**: oracle

```ts
import { createPool } from 'oracledb';
import { OracleDBPoolQueryRunner } from "ts-sql-query/queryRunners/OracleDBPoolQueryRunner";

const poolPromise = createPool({
    user: 'user',
    password: 'pwd',
    connectString: 'localhost/XEPDB1'
});

async function closePoolAndExit() {
    try {
        const pool = await poolPromise;
        await pool.close(10);
        process.exit(0);
    } catch(err) {
        process.exit(1);
    }
}

process
  .once('SIGTERM', closePoolAndExit)
  .once('SIGINT',  closePoolAndExit)
  .once('beforeExit',  closePoolAndExit);

async function main() {
    const pool = await poolPromise;
    const connection = new DBConection(new OracleDBPoolQueryRunner(pool));
    // Do your queries here
}
```

### oracledb (with a connection)

It allows to execute the queries using an [oracledb](https://www.npmjs.com/package/oracledb) connection.

**Supported databases**: oracle

```ts
import { createPool } from 'oracledb';
import { OracleDBQueryRunner } from "ts-sql-query/queryRunners/OracleDBQueryRunner";

async function init() {
    try {
        await createPool({
            user: 'user',
            password: 'pwd',
            connectString: 'localhost/XEPDB1'
        });
        await main();
    } finally {
        await closePoolAndExit();
    }
}

async function closePoolAndExit() {
    try {
        await oracledb.getPool().close(10);
        process.exit(0);
    } catch(err) {
        process.exit(1);
    }
}

process
  .once('SIGTERM', closePoolAndExit)
  .once('SIGINT',  closePoolAndExit)
  .once('beforeExit',  closePoolAndExit);

init();

async function main() {
    const oracleConnection = await oracledb.getConnection();
    try {
        const connection = new DBConection(new OracleDBQueryRunner(oracleConnection));
        // Do your queries here
    } finally {
        await oracleConnection.close();
    }
}
```

### pg (with a connection pool)

It allows to execute the queries using a [pg](https://www.npmjs.com/package/pg) connection pool.

**Supported databases**: postgreSql

```ts
import { Pool, PoolClient } from 'pg';
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool({
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
});

async function main() {
    const connection = new DBConection(new PgPoolQueryRunner(pool));
    // Do your queries here
}
```

### pg (with a connection)

It allows to execute the queries using a [pg](https://www.npmjs.com/package/pg) connection.

**Supported databases**: postgreSql

```ts
import { Pool, PoolClient } from 'pg';
import { PgQueryRunner } from "ts-sql-query/queryRunners/PgQueryRunner";

const pool = new Pool({
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
});

async function main() {
    const pgConnection = await pool.connect();
    try {
        const connection = new DBConection(new PgQueryRunner(pgConnection));
        // Do your queries here
    } finally {
        pgConnection.release();
    }
}
```

### sqlite

It allows to execute the queries using an [sqlite](https://www.npmjs.com/package/sqlite) connection.

**Supported databases**: sqlite

```ts
import { Database } from 'sqlite3';
import { open } from 'sqlite';
import { SqliteQueryRunner } from "ts-sql-query/queryRunners/SqliteQueryRunner";

const dbPromise = open({ 
    filename: './database.sqlite',
    driver: sqlite3.Database
});

async function main() {
    const db = await dbPromise;
    const connection = new DBConection(new SqliteQueryRunner(db));
    // Do your queries here
}
```

### sqlite3

It allows to execute the queries using an [sqlite3](https://www.npmjs.com/package/sqlite3) connection.

**Supported databases**: sqlite

```ts
import { Database } from 'sqlite3';
import { Sqlite3QueryRunner } from "ts-sql-query/queryRunners/Sqlite3QueryRunner";

const db = new Database('./database.sqlite');

async function main() {
    const connection = new DBConection(new Sqlite3QueryRunner(db));
    // Do your queries here
}
```

### tedious (with a connection poll)

It allows to execute the queries using a [tedious](https://www.npmjs.com/package/tedious) connection and a [tedious-connection-pool](https://www.npmjs.com/package/tedious-connection-pool) pool.

**Note**: This is not working due the bug https://github.com/tediousjs/tedious-connection-pool/issues/60

**Supported databases**: sqlServer

```ts
const ConnectionPool = require('tedious-connection-pool');
import { TediousPoolQueryRunner } from "ts-sql-query/queryRunners/TediousPoolQueryRunner";

var poolConfig = {
    min: 2,
    max: 4,
    log: true
};

var connectionConfig = {
    userName: 'login',
    password: 'password',
    server: 'localhost'
};

var pool = new ConnectionPool(poolConfig, connectionConfig);

async function main() {
    const connection = new DBConection(new TediousPoolQueryRunner(pool));
    // Do your queries here
}
```

### tedious (with a connection)

It allows to execute the queries using a [tedious](https://www.npmjs.com/package/tedious) connection and a [tedious-connection-pool](https://www.npmjs.com/package/tedious-connection-pool) pool.

**Supported databases**: sqlServer

```ts
const ConnectionPool = require('tedious-connection-pool');
import { TediousQueryRunner } from "ts-sql-query/queryRunners/TediousQueryRunner";

var poolConfig = {
    min: 2,
    max: 4,
    log: true
};

var connectionConfig = {
    userName: 'login',
    password: 'password',
    server: 'localhost'
};

var pool = new ConnectionPool(poolConfig, connectionConfig);

function main() {
    pool.acquire((error, sqlServerConnection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConection(new TediousQueryRunner(sqlServerConnection));
            doYourLogic(connection).finnaly(() => {
                sqlServerConnection.release();
            });
        } catch(e) {
            sqlServerConnection.release();
            throw e;
        }
    });
}

async doYourLogic(connection: DBConection) {
    // Do your queries here
}
```

## Advanced

### Custom booleans values

Sometimes, especially in Oracle databases, you need to represent a boolean with other values except true or false. For example, if your field in the database represents the true value with the char `Y` and the false value with the char `N`.

For example:

```ts
import { Table } from "ts-sql-query/Table";
import { CustomBooleanTypeAdapter } from "ts-sql-query/TypeAdapter";

const tCustomCompany = new class TCustomCompany extends Table<DBConection, 'TCustomCompany'> {
    id = this.autogeneratedPrimaryKey('id', 'int');
    name = this.column('name', 'string');
    isBig = this.column('is_big', 'boolean', new CustomBooleanTypeAdapter('Y', 'N'));
    constructor() {
        super('custom_company'); // table name in the database
    }
}();
```

The table `custom_company` the field `is_big` accepts the values `Y` and `N`. This field represents a boolean type, and on the JavaScript side, it will be mapped as boolean. But, on the database side, the field will be treated with appropriated values. The conversion between values will be performed by ts-sql-query automatically; you don't need to be worried about the type mismatching even if you try to assign the value to another field with a different way of representing booleans.

You can perform an insert in this way:

```ts
const insertCustomCompany = connection.insertInto(tCustomCompany).set({
        name: 'My Big Company',
        isBig: true
    }).returningLastInsertedId()
    .executeInsert();
```

The executed query is:
```sql
insert into custom_company (name, is_big) 
values ($1, case when $2 then 'Y' else 'N' end) 
returning id
```

The parameters are: `[ 'My Big Company', true ]`

The result type is:
```ts
const insertCustomCompany: Promise<number>
```

Or a select:

```ts
const selectAllBigCompanies = connection.selectFrom(tCustomCompany)
    .where(tCustomCompany.isBig)
    .select({
        id: tCustomCompany.id,
        name: tCustomCompany.name,
        isBig: tCustomCompany.isBig
    }).executeSelectMany();
```

The executed query is:
```sql
select id as id, name as name, (is_big = 'Y') as isBig 
from custom_company 
where (is_big = 'Y')
```

The parameters are: `[]`

The result type is:
```ts
const selectAllBigCompanies: Promise<{
    id: number;
    name: string;
    isBig: boolean;
}[]>
```

### Synchronous query runners

Some query runners support to execute the queries synchronously if you provide a Promise implementation that supports it, like [synchronous-promise](https://www.npmjs.com/package/synchronous-promise).

The query runners that support execute queries synchronously if you specify a synchronous Promise implementation are:
- [BetterSqlite3QueryRunner](#better-sqlite3)
- [ConsoleLogNoopQueryRunner](#consolelognoopqueryrunner)
- [MockQueryRunner](#mockqueryrunner)
- [NoopQueryRunner](#noopqueryrunner)

For example:

```ts
import { BetterSqlite3QueryRunner } from "ts-sql-query/queryRunners/BetterSqlite3QueryRunner";
import * as betterSqlite3 from "better-sqlite3";
import { SynchronousPromise } from "synchronous-promise";

const db = betterSqlite3('foobar.db', options);

async function main() {
    const connection = new DBConection(new BetterSqlite3QueryRunner(db, { promise: SynchronousPromise }));
    // Do your queries here,  surrounding it by the sync function. For example:
    const selectCompanies = sync(connection.selectFrom(tCompany)
    .where(tCustomCompany.isBig)
    .select({
        id: tCompany.id,
        name: tCompany.name
    }).executeSelectMany());

    var result = sync(connection.insertInto...)
    result = sync(connection.update...)
    result = sync(connection.delete...)
}
```

In the case of [synchronous-promise](https://www.npmjs.com/package/synchronous-promise), you will need this utility function that transforms a promise in a synchronous output:

```ts
/**
 * This function unwraps the synchronous promise in a synchronous way returning the result.
 */
function sync<T>(promise: Promise<T>): T {
    let returned = false
    let errorReturned = false
    let result: any
    let error: any
    promise.then(r => {
        returned = true
        result = r
    }, e => {
        errorReturned = true
        error = e
    })

    if (!returned && !errorReturned) {
        throw new Error('You performed a real async operation, not a database operation, inside the function dedicated to calling the database')
    }
    if (errorReturned) {
        throw error
    }
    return result
}
```

### Encrypted ID

Sometimes you want to encrypt the ID handled by the database. To do it, you can create a custom data type and define the type conversion using a type adapter or extending the default type adapter. During the type conversion, you can encrypt and decrypt with the strategy you like; for the next example, [IDEncrypter](https://github.com/juanluispaz/ts-sql-query/blob/master/src/extras/IDEncrypter.ts) will be used (included in ts-sql-query).

You can create the connection and define the rules to handle a type called `encryptedID`:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";
import { IDEncrypter } from "ts-sql-query/extras/IDEncrypter";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 

    // PasswordEncrypter requires two strings of 16 chars of [A-Za-z0-9] working as passwords for the encrypt process
    private encrypter = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c');

    protected transformValueFromDB(value: unknown, type: string): unknown {
        if (type === 'encryptedID') {
            const id = super.transformValueFromDB(value, 'bigint');
            if (typeof id === 'bigint') {
                return this.encrypter.encrypt(id);
            } else {
                // return the value as is, it could be null
                return id;
            }
        }
        return super.transformValueFromDB(value, type);
    }
    protected transformValueToDB(value: unknown, type: string): unknown {
        if (type === 'encryptedID') {
            if (value === null || value === undefined) {
                // In case of null or undefined send null to the database
                return null;
            } else if (typeof value === 'string') {
                const id = this.encrypter.decrypt(value);
                return super.transformValueToDB(id, 'bigint');
            } else {
                throw new Error('Invalid id: ' + value);
            }
        }
        return super.transformValueToDB(value, type);
    }
}
```

You can create the table, specifying the id type as `custom` or `customComparable` with type name `encryptedID` and data type `string` (the type of the encrypted data):

```ts
import { Table } from "ts-sql-query/Table";

const tCompany = new class TCompany extends Table<DBConection, 'TCompany'> {
    id = this.autogeneratedPrimaryKey<string>('id', 'customComparable', 'encryptedID');
    name = this.column('name', 'string');
    constructor() {
        super('company'); // table name in the database
    }
}();

const tCustomer = new class TCustomer extends Table<DBConection, 'TCustomer'> {
    id = this.autogeneratedPrimaryKey<string>('id', 'customComparable', 'encryptedID');
    firstName = this.column('first_name', 'string');
    lastName = this.column('last_name', 'string');
    birthday = this.optionalColumn('birthday', 'localDate');
    companyId = this.column<string>('company_id', 'customComparable', 'encryptedID');
    constructor() {
        super('customer'); // table name in the database
    }
}();
```

If you execute an insert that returns the id, the id will be encrypted:

```ts
const id = await connection
            .insertInto(tCompany)
            .values({ name: 'ACME' })
            .returningLastInsertedId()
            .executeInsert()
```

The returned id will be 'uftSdCUhUTBQ0111' for id 1 in the database.

You can perform a select using the encrypted id:

```ts
let company = await connection
            .selectFrom(tCompany)
            .where(tCompany.id.equals('uftSdCUhUTBQ0111'))
            .select({
                id: tCompany.id,
                name: tCompany.name
            })
            .executeSelectOne()
```

The id used in the query will be sent to the database decrypted.

See [IDEncrypter](https://github.com/juanluispaz/ts-sql-query/blob/master/src/extras/IDEncrypter.ts) for more information to know how the password is encrypted.

## License

MIT

<!--
Edited with: https://stackedit.io/app
-->
