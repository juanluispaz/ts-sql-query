---
search:
  boost: 3
---
# Basic query structure

This section demonstrates how to construct and execute basic `SELECT` queries using `ts-sql-query`, providing examples of different selection methods and result-handling options.

## Select one row

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

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as [lastName], 
        birthday as birthday 
    from customer 
    where id = @0
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customerWithId: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
}>
```

The `executeSelectOne` returns one result, but if it is not found in the database an exception will be thrown. If you want to return the result when it is found or null when it is not found you must use the `executeSelectNoneOrOne` method.

## Projecting optional values

By default, when an object is returned, optional values will be projected as optional properties in TypeScript, like `birthday?: Date`; when the value is absent, the property will not be set. However, you can change this behaviour so that all properties are always present, even if they contain `null`, like `birthday: Date | null` where, in case there is no value, the property will be set as null. To change this behaviour, call `projectingOptionalValuesAsNullable()` immediately after defining the projected columns with `select({...})`.

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
    .projectingOptionalValuesAsNullable()
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as [lastName], 
        birthday as birthday 
    from customer 
    where id = @0
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customerWithId: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday: Date | null;
}>
```

!!! note

    Projecting always-required properties that allow null values works in the same way with insert, update or deletes if you call `projectingOptionalValuesAsNullable()` immediately after `returning(...)`. This also applies to `connection.aggregateAsArray(...).projectingOptionalValuesAsNullable()`.

## Other options

You can execute the query using:

- `executeSelectNoneOrOne(): Promise<RESULT | null>`: execute the select query that returns one or no result from the database. In case of more than one result found, it throws and error with message 'Too many rows, expected only zero or one row'.
- `executeSelectOne(): Promise<RESULT>`: execute the select query that returns one result from the database. If no result is returned by the database an exception will be thrown.
- `executeSelectMany(): Promise<RESULT[]>`: execute the select query that returns zero or many results from the database
- `executeSelectPage(): Promise<{ data: RESULT[], count: number }>`: executes a `SELECT` query that returns zero or more results. When using `executeSelectPage`, two queries are executed: one to retrieve the data and another to count the total number of matching rows (ignoring any `LIMIT` or `OFFSET`).
- `executeSelectPage<EXTRAS extends {}>(extras: EXTRAS): Promise<{ data: RESULT[], count: number } & EXTRAS>`: execute the select query as a select page, but allows the resulting object to include additional custom properties. If the object provided by argument includes the property count, the query that count the data will be omitted and this value will be used. If the object provided by argument includes the property data, the query that extract the data will be omitted and this value will be used.

Additionally, if you want to return the value of a single column, you can use `selectOneColumn(column)` instead of `select({...})`; or if you want to return `count(*)` as a single column, you can use `selectCountAll()`.
