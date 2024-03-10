# SQL fragments

## Select with custom SQL fragment

SQL fragments allows to include sql in your query, that give you the possibility to do some operations not included in ts-sql-query.

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
```tsx
const customersUsingCustomFragment: Promise<{
    idAsString: string;
    name: string;
} | null>
```

## Select with custom reusable SQL fragment

You can define functions in your connection that create custom reusable SQL fragments, that give you the possibility to do some operations or functions not included in ts-sql-query.

If you define your connection like:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 

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

You will define the function `bitwiseShiftLeft` that receives two `int` as argument and returns an `int`; these arguments can be numbers or elements in the database that represent integer numbers. If you create the argument using the function `valueArg` instead of the `arg` function, the defined function will accept values only but not database elements. You can use the defined function as a regular database function in your query.

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
```tsx
const companiesUsingCustomFunctionFragment: Promise<{
    id: number;
    name: string;
    idMultiplyBy2: number;
}[]>
```

## Select with custom reusable SQL fragment if value

You can define functions in your connection that create custom reusable SQL fragments that have the same behaviour of the functions with name ended with `IfValue`, that give you the possibility to do some operations or functions not included in ts-sql-query.

ts-sql-query offers many commodity methods with name ended with `IfValue` to build dynamic queries; these methods allow to be ignored when the values specified by argument are `null` or `undefined` or an empty string (only when the `allowEmptyString` flag in the connection is not set to true, that is the default behaviour). When these methods are used in operations that return booleans value, ts-sql-query is smart enough to omit the operation when it is required, even when the operation is part of complex composition with `and`s and `or`s.

The method `buildFragmentWithArgsIfValue` allows you to create a function, where if any optional value argument receives `null` or `undefined` or an empty string, the execution of the provided function is omitted.

If you define your connection like:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 

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

You will define the function `bitwiseShiftLeft` that receives two `int` as argument and returns an `int`; these arguments can be numbers or elements in the database that represent integer numbers. If you create the argument using the function `valueArg` instead of the `arg` function, the defined function will accept values only but not database elements. You can use the defined function as a regular database function in your query.

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
```tsx
const companiesUsingCustomFunctionFragment: Promise<{
    id: number;
    name: string;
}[]>
```

## Select with custom reusable SQL fragment (maybe optional)

You can define functions in your connection that create custom reusable SQL fragments that detect if the returned value is required or optional based on the provided arguments, that give you the possibility to do some operations or functions not included in ts-sql-query allowing to have overloaded version where the returned type can be required or optional.

If you define your connection like:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 

    bitwiseShiftLeft = this.buildFragmentWithMaybeOptionalArgs(
        this.arg('int', 'optional'),
        this.arg('int', 'optional')
    ).as((left, right) => {
        // The fragment here is: ${left} << ${right}
        // Could be another fragment like a function call: myFunction(${left}, ${right})
        return this.fragmentWithType('int', 'optional').sql`${left} << ${right}`
    })
}
```

You will define the function `bitwiseShiftLeft` that receives two `int` as argument and returns an `int`; these arguments can be numbers or elements in the database that represent integer numbers. If you create the argument using the function `valueArg` instead of the `arg` function, the defined function will accept values only but not database elements. You can use the defined function as a regular database function in your query. The function will return an optional value if any of the provided arguments when invoked is optional; otherwise, the return type will be marked as required. **Note**: All arguments that can be optional must be marked as optional; the return fragment must be marked as optional.

```ts
const bitwiseMovements = null;
const multiplier = 2;

const companiesUsingCustomFunctionFragment = connection.selectFrom(tCompany)
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
```

The parameters are: `[ null, 2 ]`

The result type is:
```tsx
const companiesUsingCustomFunctionFragment: Promise<{
    id: number;
    name: string;
    idMultiplyBy2?: number;
}[]>
```

## Raw SQL

ts-sql-query offers you to write raw sql to extends and customize the generated queries in several places

```ts
const from = this.const(new Date('2019-01-01'), 'localDateTime')
const to = this.const(new Date('2020-01-01'), 'localDateTime')
const fragment = connection.rawFragment`between ${from} and ${to}`
```

## Table or view customization

Some databases offer additional features that require writing the table name in some way in the from clause. For example, Sql Server and MariaDB have temporal tables that track all the changes in a table, allowing you to query a row with its values at a specific moment in time. For use temporal tables, when you refer to the table in the from, you must indicate the moment in time that you want to query. Oracle offers something similar called "Oracle Flashback Technology", but with a different syntax.

ts-sql-query allows you to customize the SQL required to use the table, allowing you to use features not already supported by ts-sql-query like the temporal tables. To do it, you must call the `createTableOrViewCustomization` in the connection to create a function that performs that task. This method receives as an argument a function that must return the raw fragment of the SQL; this function receives as arguments the table name and the alias; any other argument will be included in the generated function. The generated function receives as first argument the table or view, as second argument a name for the customization, and any other argument required by the previous function.

**Example**:

You must define the connection with the customization function as:
```ts
class DBConnection extends SqlServerConnection<'DBConnection'> { 

    forSystemTimeBetween = this.createTableOrViewCustomization<Date, Date>((table, alias, fromDate, toDate) => {
        const from = this.const(fromDate, 'localDateTime')
        const to = this.const(toDate, 'localDateTime')
        return this.rawFragment`${table} for system_time between ${from} and ${to} ${alias}`
    })
}
```

When you write the query, you use the customization function as:
```ts
const customerIn2019 = connection.forSystemTimeBetween(tCustomer, 'customerIn2019', new Date('2019-01-01'), new Date('2020-01-01'))

const customerInSystemTime = connection.selectFrom(customerIn2019)
    .where(customerIn2019.id.equals(10))
    .select({
        id: customerIn2019.id,
        firstName: customerIn2019.firstName,
        lastName: customerIn2019.lastName,
        birthday: customerIn2019.birthday
    })
    .executeSelectMany()
```

The executed query is:
```sql
select id as id, first_name as firstName, last_name as lastName, birthday as birthday 
from customer for system_time between $1 and $2  
where id = $3
```

The parameters are: `[ 2019-01-01T00:00:00.000Z, 2020-01-01T00:00:00.000Z, 10 ]`

The result type is:
```tsx
const customerInSystemTime: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
}[]>
```

## Customizing a select

The method `customizeQuery` offers you to inject raw fragments of SQL in the query, allowing you to extend its functionality when the required feature is not supported by ts-sql-query API.

The supported extension point offered by `customizeQuery` are:

- `afterSelectKeyword`: Place the fragment immediately after the `select` keyword.
- `beforeColumns`: Place the fragment immediately before the column list and after the `distinct` keyword.
- `customWindow`: Place the fragment as a `window` clause (the `window` keyboard will be added automatically).
- `beforeOrderByItems`: Place the fragment before the `order by` items produced by the query (the `order by` keyboard and the required commas will be added automatically).
- `afterOrderByItems`: Place the fragment after the `order by` items produced by the query (the `order by` keyboard and the required commas will be added automatically).
- `beforeQuery`: Place the fragment at the beginning of the query.
- `afterQuery`: Place the fragment at the end of the query.
- `beforeWithQuery`: Place the fragment in the with clause (when the query is marked `forUseInQuery`) immediately after the `as` keyboard and before the open parenthesis that contains the query.
- `afterWithQuery`: Place the fragment in the with clause (when the query is marked `forUseInQuery`) immediately after the close parenthesis that contains the query.
- `queryExecutionName`: Informative name for the query execution.
- `queryExecutionMetadata`: Additional metadata for the query execution.

```ts
const customizedSelect = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    }).customizeQuery({
        afterSelectKeyword: connection.rawFragment`/*+ some hints */`,
        afterQuery: connection.rawFragment`for update`
    })
    .executeSelectOne()
```

The executed query is:
```sql
select /*+ some hints */ id as id, first_name as firstName, last_name as lastName, birthday as birthday 
from customer 
where id = $1 
for update
```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customizedSelect: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
}>
```

## Customizing an insert

The supported extension point offered by `customizeQuery` method for an insert are:

- `afterInsertKeyword`: Place the fragment immediately after the `insert` keyword.
- `beforeQuery`: Place the fragment at the beginning of the query.
- `afterQuery`: Place the fragment at the end of the query.
- `queryExecutionName`: Informative name for the query execution.
- `queryExecutionMetadata`: Additional metadata for the query execution.

```ts
const customizedInsert = connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    }).customizeQuery({
        afterInsertKeyword: connection.rawFragment`/*+ some hints */`,
        afterQuery: connection.rawFragment`log errors reject limit unlimited`
    }).executeInsert()
```

The executed query is:
```sql
insert /*+ some hints */ into customer (first_name, last_name, company_id) 
values ($1, $2, $3) 
log errors reject limit unlimited
```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customizedInsert: Promise<number>
```

## Customizing an update

The supported extension point offered by `customizeQuery` method for an update are:

- `afterUpdateKeyword`: Place the fragment immediately after the `update` keyword.
- `beforeQuery`: Place the fragment at the beginning of the query.
- `afterQuery`: Place the fragment at the end of the query.
- `queryExecutionName`: Informative name for the query execution.
- `queryExecutionMetadata`: Additional metadata for the query execution.

```ts
const customizedUpdate = connection.update(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith'
    }).where(tCustomer.id.equals(10))
    .customizeQuery({
        afterUpdateKeyword: connection.rawFragment`/*+ some hints */`,
        afterQuery: connection.rawFragment`keep plan`,
    })
    .executeUpdate()
```

The executed query is:
```sql
update /*+ some hints */ customer 
set first_name = $1, last_name = $2 
where id = $3 
keep plan
```

The parameters are: `[ 'John', 'Smith', 10 ]`

The result type is:
```tsx
const customizedUpdate: Promise<number>
```

## Customizing a delete

The supported extension point offered by `customizeQuery` method for a delete are:

- `afterDeleteKeyword`: Place the fragment immediately after the `delete` keyword.
- `beforeQuery`: Place the fragment at the beginning of the query.
- `afterQuery`: Place the fragment at the end of the query.
- `queryExecutionName`: Informative name for the query execution.
- `queryExecutionMetadata`: Additional metadata for the query execution.

```ts
const customizedDelete = connection.deleteFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .customizeQuery({
        afterDeleteKeyword: connection.rawFragment`/*+ some hints */`,
        afterQuery: connection.rawFragment`keep plan`,
    })
    .executeDelete()
```

The executed query is:
```sql
delete /*+ some hints */ 
from customer 
where id = $1 
keep plan
```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customizedDelete: Promise<number>
```