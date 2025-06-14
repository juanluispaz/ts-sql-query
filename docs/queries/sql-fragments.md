---
search:
  boost: 0.92
---
# SQL fragments

This page documents the use of SQL fragments in `ts-sql-query`.

Fragments allow injecting custom SQL expressions at specific points in a query, enabling support for operations that are not covered by the built-in API. They are intended for advanced use cases where database-specific features or unsupported syntax need to be expressed manually, while maintaining type safety.

The following mechanisms are supported:

- `fragmentWithType`: injects raw SQL expressions with declared type and nullability.
- `buildFragmentWithArgs`: defines reusable fragments with arguments.
- `buildFragmentWithArgsIfValue`: adds conditional logic to omit fragments based on null or undefined inputs.
- `buildFragmentWithMaybeOptionalArgs`: infers nullability of the result based on the arguments provided.
- `rawFragment`: inserts raw SQL without type guarantees.
- `createTableOrViewCustomization`: defines alternative renderings for table or view references.
- `customizeQuery`: customizes the generated SQL for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` statements.

Each feature is described in its own section with examples of usage, generated SQL, and type inference.

## Defining custom SQL expressions

This section describes how to define custom SQL expressions that can be used inside queries. These expressions are implemented as fragments and behave like inline SQL functions, enabling support for database-specific operators or operations not directly supported by `ts-sql-query`.

Fragments can be defined with fixed arguments, conditional logic based on optional values, or inferred nullability depending on the input. All of them preserve type safety and integrate seamlessly with the rest of the query building process.

### Inline fragments

SQL fragments allow you to inject raw SQL into your queries, enabling operations not natively supported by `ts-sql-query`.

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

=== "MariaDB"
    ```mariadb
    select 
        id::varchar as idAsString, 
        concat(first_name, ?, last_name) as name 
    from customer 
    where !!id = !!?
    ```
=== "MySQL"
    ```mysql
    select 
        id::varchar as idAsString, 
        concat(first_name, ?, last_name) as `name` 
    from customer 
    where !!id = !!?
    ```
=== "Oracle"
    ```oracle
    select 
        id::varchar as "idAsString", 
        first_name || :0 || last_name as "name" 
    from customer 
    where !!id = !!:1
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id::varchar as "idAsString", 
        first_name || $1 || last_name as name 
    from customer 
    where !!id = !!$2
    ```
=== "SQLite"
    ```sqlite
    select 
        id::varchar as idAsString, 
        first_name || ? || last_name as name 
    from customer 
    where !!id = !!?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id::varchar as idAsString, 
        first_name + @0 + last_name as name 
    from customer 
    where !!id = !!@1
    ```

The parameters are: `[ ' ', 10 ]`

The result type is:
```tsx
const customersUsingCustomFragment: Promise<{
    idAsString: string;
    name: string;
} | null>
```

### Reusable fragments

You can define functions in your connection that create custom reusable SQL fragments, that let you express operations or functions not available through the default API.

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

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name, 
        id << ? as idMultiplyBy2 
    from company 
    where (id * ?) = (id << ?)
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name`, 
        id << ? as idMultiplyBy2 
    from company 
    where (id * ?) = (id << ?)
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        id << :0 as "idMultiplyBy2" 
    from company 
    where (id * :1) = (id << :2)
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        id << $1 as "idMultiplyBy2" 
    from company 
    where (id * $2) = (id << $3)
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        id << ? as idMultiplyBy2 
    from company 
    where (id * ?) = (id << ?)
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name, 
        id << @0 as idMultiplyBy2 
    from company 
    where (id * @1) = (id << @2)
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

### Conditional fragments

You can define functions in your connection that create custom reusable SQL fragments that behave like functions whose names end with `IfValue`, that let you express operations or functions not available through the default API.

`ts-sql-query` provides several helper methods whose names end in `IfValue` to build dynamic queries; these methods allow to be ignored when the values specified by argument are `null` or `undefined` or an empty string (only when the `allowEmptyString` flag in the connection is not set to true, that is the default behaviour). When these methods are used in operations that return booleans value, `ts-sql-query` is smart enough to omit the operation when it is required, even when the operation is part of complex composition with `and`s and `or`s.

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

You will define the function `valuePlusOneEqualsIfValue` that receives one `int` and one optional `int`, and returns a boolean expression. These arguments can be numbers or database elements. The function is skipped automatically when the optional argument is null or undefined.

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

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name 
    from company 
    where id + 1 = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name` 
    from company 
    where id + 1 = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where id + 1 = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    where id + 1 = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    where id + 1 = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where id + 1 = @0
    ```

The parameters are: `[ 2 ]`

The result type is:
```tsx
const companiesUsingCustomFunctionFragment: Promise<{
    id: number;
    name: string;
}[]>
```

### Nullable fragments

You can define functions in your connection that create custom reusable SQL fragments that detect if the returned value is required or optional based on the provided arguments, that give you the possibility to do some operations or functions not included in `ts-sql-query` allowing to have overloaded version where the returned type can be required or optional.

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

You will define the function `bitwiseShiftLeft` that receives two `int` as argument and returns an `int`; these arguments can be numbers or elements in the database that represent integer numbers. If you create the argument using the function `valueArg` instead of the `arg` function, the defined function will accept values only but not database elements. You can use the defined function as a regular database function in your query. The function will return an optional value if any of the provided arguments when invoked is optional; otherwise, the return type will be marked as required.

!!! warning

    When using `buildFragmentWithMaybeOptionalArgs`, you must ensure that:
    
    - All arguments that might be omitted are explicitly marked as `optional`.
    - The return fragment must also be declared as `optional`.

    Otherwise, type inference will not correctly reflect the presence of optional values in the resulting expression.

```ts
const bitwiseMovements: number | null = null;
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

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name, 
        id << ? as idMultiplyBy2 
    from company 
    where (id * ?) = (id << ?)
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name`, 
        id << ? as idMultiplyBy2 
    from company 
    where (id * ?) = (id << ?)
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        id << :0 as "idMultiplyBy2" 
    from company 
    where (id * :1) = (id << :2)
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        id << $1 as "idMultiplyBy2" 
    from company 
    where (id * $2) = (id << $3)
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        id << ? as idMultiplyBy2 
    from company 
    where (id * ?) = (id << ?)
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name, 
        id << @0 as idMultiplyBy2 
    from company 
    where (id * @1) = (id << @2)
    ```

The parameters are: `[ null, 2, null ]`

The result type is:
```tsx
const companiesUsingCustomFunctionFragment: Promise<{
    id: number;
    name: string;
    idMultiplyBy2?: number;
}[]>
```

### Raw fragments

`ts-sql-query` allows you to write raw SQL to extend and customize the generated queries in several places.

```ts
const from = this.const(new Date('2019-01-01'), 'localDateTime')
const to = this.const(new Date('2020-01-01'), 'localDateTime')
const fragment = connection.rawFragment`between ${from} and ${to}`
```

## Table or view customization

Some databases offer additional features that require writing the table name in some way in the from clause. For example, [SQL Server](../configuration/supported-databases/sqlserver.md) and [MariaDB](../configuration/supported-databases/mariadb.md) have temporal tables that track all the changes in a table, allowing you to query a row with its values at a specific moment in time. For use temporal tables, when you refer to the table in the from, you must indicate the moment in time that you want to query. [Oracle](../configuration/supported-databases/oracle.md) offers something similar called "Oracle Flashback Technology", but with a different syntax.

`ts-sql-query` allows you to customize the SQL required to use the table, allowing you to use features not already supported by `ts-sql-query` like the temporal tables. To do it, you must call the `createTableOrViewCustomization` in the connection to create a function that performs that task. This method receives as an argument a function that must return the raw fragment of the SQL; this function receives as arguments the table name and the alias; any other argument will be included in the generated function. The generated function receives as first argument the table or view, as second argument a name for the customization, and any other argument required by the previous function.

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

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer for system_time between ? and ?  
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer for system_time between ? and ?  
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer for system_time between :0 and :1  
    where id = :2
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer for system_time between $1 and $2  
    where id = $3
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer for system_time between ? and ?  
    where id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer for system_time between @0 and @1  
    where id = @2
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

## Customizing queries with raw SQL

When you need to inject custom SQL that is not supported natively by `ts-sql-query`,
you can use the method `customizeQuery`. This method allows you to insert raw fragments at well-defined points in the query, without breaking type safety or the fluent interface.

Each type of SQL operation (`select`, `insert`, `update`, `delete`) has its own set of supported customization points.

### Customizing a select

The method `customizeQuery` offers you to inject raw fragments of SQL in the query, allowing you to extend its functionality when the required feature is not supported by `ts-sql-query` API.

The extension points supported by the `customizeQuery` method for a `SELECT` query are:

| Extension Point         | Description                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| `afterSelectKeyword`    | Place the fragment immediately after the `SELECT` keyword.                  |
| `beforeColumns`         | Place the fragment before the column list, after `DISTINCT`.                |
| `customWindow`          | Add a `WINDOW` clause (the keyword is added automatically).                 |
| `beforeOrderByItems`    | Place the fragment before the `ORDER BY` items (with correct commas).       |
| `afterOrderByItems`     | Place the fragment after the `ORDER BY` items (with correct commas).        |
| `beforeQuery`           | Place the fragment at the beginning of the query.                           |
| `afterQuery`            | Place the fragment at the end of the query.                                 |
| `beforeWithQuery`       | Insert in `WITH` clause before the subquery’s opening parenthesis.          |
| `afterWithQuery`        | Insert in `WITH` clause after the subquery’s closing parenthesis.           |
| `queryExecutionName`    | Assign a human-readable name for query execution.                           |
| `queryExecutionMetadata`| Attach metadata to the query execution.                                     |

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

=== "MariaDB"
    ```mariadb
    select /*+ some hints */ 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ? for update
    ```
=== "MySQL"
    ```mysql
    select /*+ some hints */ 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ? for update
    ```
=== "Oracle"
    ```oracle
    select /*+ some hints */ 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer 
    where id = :0 for update
    ```
===+ "PostgreSQL"
    ```postgresql
    select /*+ some hints */ 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer 
    where id = $1 for update
    ```
=== "SQLite"
    ```sqlite
    select /*+ some hints */ 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ? for update
    ```
=== "SQL Server"
    ```sqlserver
    select /*+ some hints */ 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = @0 for update
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

### Customizing an insert

The extension points supported by the `customizeQuery` method for an `INSERT` query are:

| Extension Point         | Description                                                           |
|-------------------------|-----------------------------------------------------------------------|
| `afterInsertKeyword`    | Place the fragment immediately after the `INSERT` keyword.            |
| `beforeQuery`           | Place the fragment at the beginning of the query.                     |
| `afterQuery`            | Place the fragment at the end of the query.                           |
| `queryExecutionName`    | Assign a human-readable name for query execution.                     |
| `queryExecutionMetadata`| Attach metadata to the query execution.                               |

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

=== "MariaDB"
    ```mariadb
    insert /*+ some hints */ 
    into customer (first_name, last_name, company_id) 
    values (?, ?, ?) 
    log errors reject limit unlimited
    ```
=== "MySQL"
    ```mysql
    insert /*+ some hints */ 
    into customer (first_name, last_name, company_id) 
    values (?, ?, ?) 
    log errors reject limit unlimited
    ```
=== "Oracle"
    ```oracle
    insert /*+ some hints */ 
    into customer (first_name, last_name, company_id) 
    values (:0, :1, :2) 
    log errors reject limit unlimited
    ```
===+ "PostgreSQL"
    ```postgresql
    insert /*+ some hints */ 
    into customer (first_name, last_name, company_id) 
    values ($1, $2, $3) 
    log errors reject limit unlimited
    ```
=== "SQLite"
    ```sqlite
    insert /*+ some hints */ 
    into customer (first_name, last_name, company_id) 
    values (?, ?, ?) 
    log errors reject limit unlimited
    ```
=== "SQL Server"
    ```sqlserver
    insert /*+ some hints */ 
    into customer (first_name, last_name, company_id) 
    values (@0, @1, @2) 
    log errors reject limit unlimited
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customizedInsert: Promise<number>
```

### Customizing an update

The extension points supported by the `customizeQuery` method for an `UPDATE` query are:
 
| Extension Point         | Description                                                           |
|-------------------------|-----------------------------------------------------------------------|
| `afterUpdateKeyword`    | Place the fragment immediately after the `UPDATE` keyword.            |
| `beforeQuery`           | Place the fragment at the beginning of the query.                     |
| `afterQuery`            | Place the fragment at the end of the query.                           |
| `queryExecutionName`    | Assign a human-readable name for query execution.                     |
| `queryExecutionMetadata`| Attach metadata to the query execution.                               |

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

=== "MariaDB"
    ```mariadb
    update /*+ some hints */ customer 
    set 
        first_name = ?, 
        last_name = ? 
    where id = ? 
    keep plan
    ```
=== "MySQL"
    ```mysql
    update /*+ some hints */ customer 
    set 
        first_name = ?, 
        last_name = ? 
    where id = ? 
    keep plan
    ```
=== "Oracle"
    ```oracle
    update /*+ some hints */ customer 
    set 
        first_name = :0, 
        last_name = :1 
    where id = :2 
    keep plan
    ```
===+ "PostgreSQL"
    ```postgresql
    update /*+ some hints */ customer 
    set 
        first_name = $1, 
        last_name = $2 
    where id = $3 
    keep plan
    ```
=== "SQLite"
    ```sqlite
    update /*+ some hints */ customer 
    set 
        first_name = ?, 
        last_name = ? 
    where id = ? 
    keep plan
    ```
=== "SQL Server"
    ```sqlserver
    update /*+ some hints */ customer 
    set 
        first_name = @0, 
        last_name = @1 
    where id = @2 
    keep plan
    ```

The parameters are: `[ 'John', 'Smith', 10 ]`

The result type is:
```tsx
const customizedUpdate: Promise<number>
```

### Customizing a delete

The extension points supported by the `customizeQuery` method for a `DELETE` query are:

| Extension Point         | Description                                                           |
|-------------------------|-----------------------------------------------------------------------|
| `afterDeleteKeyword`    | Place the fragment immediately after the `DELETE` keyword.            |
| `beforeQuery`           | Place the fragment at the beginning of the query.                     |
| `afterQuery`            | Place the fragment at the end of the query.                           |
| `queryExecutionName`    | Assign a human-readable name for query execution.                     |
| `queryExecutionMetadata`| Attach metadata to the query execution.                               |

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

=== "MariaDB"
    ```mariadb
    delete /*+ some hints */ 
    from customer 
    where id = ? 
    keep plan
    ```
=== "MySQL"
    ```mysql
    delete /*+ some hints */ 
    from customer 
    where id = ? 
    keep plan
    ```
=== "Oracle"
    ```oracle
    delete /*+ some hints */ 
    from customer 
    where id = :0 
    keep plan
    ```
===+ "PostgreSQL"
    ```postgresql
    delete /*+ some hints */ 
    from customer 
    where id = $1 
    keep plan
    ```
=== "SQLite"
    ```sqlite
    delete /*+ some hints */ 
    from customer 
    where id = ? 
    keep plan
    ```
=== "SQL Server"
    ```sqlserver
    delete /*+ some hints */ 
    from customer 
    where id = @0 
    keep plan
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customizedDelete: Promise<number>
```
