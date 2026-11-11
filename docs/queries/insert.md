---
search:
  boost: 4
---
# Insert

An insert adds new rows to a table. You start it with `connection.insertInto(table)`, say what to insert, optionally ask for something back, and execute it.

## The forms of an insert

| You want to insert | Use | Section |
|:-------------------|:----|:--------|
| One row | `.set({...})` (or its other name, `.values({...})`) | [Insert one row](#insert-one-row) |
| Several rows in one query | `.values([...])` | [Insert multiple values](#insert-multiple-values) |
| The rows returned by a select | `.from(select)` | [Insert from select](#insert-from-select) |
| One row with no values, so that every column takes its default | `.defaultValues()` | [Insert default values](#insert-default-values) |

When the values are built in steps, `.dynamicSet()` and `.dynamicValues([...])` start the insert without requiring all the columns yet: see [Manipulating values to insert](#manipulating-values-to-insert).

Which columns you must give depends on how each one is declared in the table: see [Kinds of columns](../configuration/mapping.md#kinds-of-columns). Leaving out a required column is a compilation error. A property of the object that isn't a column of the table is ignored, so an object with other data can be passed. The values of [columns in a group](../configuration/mapping.md#grouping-columns) follow the shape of the group, like `set({ name: 'ACME', ubication: { latitude: '40.4', longitude: '-3.7' } })`.

If the row can collide with an existing one, the insert can do nothing or update that row: see [Insert on conflict](insert-on-conflict.md).

## Insert one row

`set` receives the values of the row. A value can also be an expression built with the connection, like `connection.const('John', 'string').concat(' Jr.')`; and, in every database except SQLite, `connection.default()` asks the database to use the default value of the column.

In this example, `setIfNotSet` gives a value to a column only if it isn't set yet, and `returningLastInsertedId` returns the id the database generated for the row:

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

=== "MariaDB"
    ```mariadb
    insert into customer (first_name, last_name, company_id, birthday) 
    values (?, ?, ?, ?) 
    returning id
    ```
=== "MySQL"
    ```mysql
    insert into customer (first_name, last_name, company_id, birthday) 
    values (?, ?, ?, ?)
    -- Last inserted ID returned by the database got from the connection
    ```
=== "Oracle"
    ```oracle
    insert into customer (first_name, last_name, company_id, birthday) 
    values (:0, :1, :2, :3) 
    returning id 
    into :4
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id, birthday) 
    values ($1, $2, $3, $4) 
    returning id
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id, birthday) 
    values (?1, ?2, ?3, ?4) 
    returning id
    ```
=== "SQL Server"
    ```sqlserver
    insert into customer (first_name, last_name, company_id, birthday) 
    output inserted.id 
    values (@0, @1, @2, @3)
    ```

The parameters are: `[ 'John', 'Smith', 1, 2019-08-16T15:02:32.849Z ]` (on SQLite: `[ 'John', 'Smith', 1, '2019-08-16' ]`; on [Oracle](../configuration/supported-databases/oracle.md), output parameters are added at the corresponding position with the structure `{dir:3003}`) 

The result type is a promise with the id of the last inserted row:
```tsx
const insertCustomer: Promise<number>
```

## Insert multiple values

`values` with an array inserts all the rows at once, instead of executing one insert per row. An empty array sends no query: `executeInsert()` returns `0` (or `[]` with `returningLastInsertedId()`), `executeInsertMany()` returns `[]`, `executeInsertNoneOrOne()` returns `null`, and the promise of `executeInsertOne()` rejects with `NO_RESULT`.

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

=== "MariaDB"
    ```mariadb
    insert into customer (first_name, last_name, company_id) 
    values 
        (?, ?, ?), 
        (?, ?, ?) 
    returning id
    ```
=== "MySQL"
    ```mysql
    --
    --
    -- MySQL doesn't support inserting multiple values returning last inserted ID
    --
    --
    ```
=== "Oracle"
    ```oracle
    begin 

    insert into customer (first_name, last_name, company_id) 
    values (:0, :1, :2) 
    returning id 
    into :3; 

    insert into customer (first_name, last_name, company_id) 
    values (:4, :5, :6) 
    returning id 
    into :7; 

    end;
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id) 
    values 
        ($1, $2, $3), 
        ($4, $5, $6) 
    returning id
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id) 
    values 
        (?1, ?2, ?3), 
        (?4, ?5, ?6) 
    returning id
    ```
=== "SQL Server"
    ```sqlserver
    insert into customer (first_name, last_name, company_id) 
    output inserted.id 
    values 
        (@0, @1, @2), 
        (@3, @4, @5)
    ```

The parameters are: `[ 'John', 'Smith', 1, 'Other', 'Person', 1 ]` (On [Oracle](../configuration/supported-databases/oracle.md), output parameters are added at the corresponding position with the structure `{dir:3003}`)

The result type is a promise with the id of the last inserted rows:
```tsx
const insertMultipleCustomers: Promise<number[]>
```

!!! note

    Returning the last inserted id of an insert with multiple rows isn't available on **[MySQL](../configuration/supported-databases/mysql.md)**, where it is a compilation error, and it needs a modern [SQLite](../configuration/supported-databases/sqlite.md) or [MariaDB](../configuration/supported-databases/mariadb.md): see [Availability per database](#availability-per-database).

## Insert from select

`from` inserts the rows a select returns, for example to copy rows or to fill a table from others. The database does all the work, so the rows don't travel to your application.

Each column of the select is inserted in the column of the table with the same name (the name in the object of `select`), so the required columns of the table must be there, and a name that isn't a column of the table is a compilation error. The methods that manipulate values don't apply here: the values come from the select. The [on conflict](insert-on-conflict.md) clause can follow.

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

=== "MariaDB"
    ```mariadb
    insert into customer (first_name, last_name, company_id) 
    select 
        first_name as firstName, 
        last_name as lastName, 
        company_id as companyId 
    from customer 
    where company_id = ?
    ```
=== "MySQL"
    ```mysql
    insert into customer (first_name, last_name, company_id) 
    select 
        first_name as firstName, 
        last_name as lastName, 
        company_id as companyId 
    from customer 
    where company_id = ?
    ```
=== "Oracle"
    ```oracle
    insert into customer (first_name, last_name, company_id) 
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        company_id as "companyId" 
    from customer 
    where company_id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id) 
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        company_id as "companyId" 
    from customer 
    where company_id = $1
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id) 
    select 
        first_name as firstName, 
        last_name as lastName, 
        company_id as companyId 
    from customer 
    where company_id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    insert into customer (first_name, last_name, company_id) 
    select 
        first_name as firstName, 
        last_name as lastName, 
        company_id as companyId 
    from customer 
    where company_id = @0
    ```

The parameters are: `[ 1 ]`

The result type is a promise with the number of inserted rows:
```tsx
const insertCustomersFromSelect: Promise<number>
```

## Insert default values

`defaultValues()` inserts a row where every column takes its default value; it is available when the table has no required column (every column is optional, has a default value or is generated by the database). No [on conflict](insert-on-conflict.md) clause can follow it.

```ts
const tAuditEvent = new class TAuditEvent extends Table<DBConnection, 'TAuditEvent'> {
    id = this.autogeneratedPrimaryKey('id', 'int');
    createdAt = this.columnWithDefaultValue('created_at', 'localDateTime');
    constructor() {
        super('audit_event'); // table name in the database
    }
}();

const eventId = await connection.insertInto(tAuditEvent)
    .defaultValues()
    .returningLastInsertedId()
    .executeInsert();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    insert into audit_event ()
    values ()
    returning audit_event.id
    ```
=== "MySQL"
    ```mysql
    insert into audit_event ()
    values ()
    ```
=== "Oracle"
    ```oracle
    insert into audit_event (id, created_at)
    values (default, default)
    returning id into :0
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into audit_event
    default values
    returning id
    ```
=== "SQLite"
    ```sqlite
    insert into audit_event
    default values
    returning id
    ```
=== "SQL Server"
    ```sqlserver
    insert into audit_event
    output inserted.id
    default values
    ```

The parameters are: `[]`

The result type is:
```tsx
const eventId: number
```

## What an insert returns

What you get depends on what you ask for before executing:

| To get | Call | Execute with | Result |
|:-------|:-----|:-------------|:-------|
| The number of inserted rows | | `executeInsert()` | `number` |
| The id generated for the row | `returningLastInsertedId()` | `executeInsert()` | The id |
| The ids generated for several rows | `returningLastInsertedId()`, after `.values([...])` or `.from(...)` | `executeInsert()` | An array with the ids |
| Columns of exactly one inserted row | `returning({...})` | `executeInsertOne()` | An object |
| Columns of one inserted row, if any | `returning({...})` | `executeInsertNoneOrOne()` | An object, or `null` |
| Columns of all the inserted rows | `returning({...})` | `executeInsertMany()` | An array of objects |
| One column | `returningOneColumn(column)` | Any of the last three | The value, instead of an object |

Use `returningLastInsertedId()` when the id is all you need; it requires a table with an autogenerated primary key, otherwise it is a compilation error. Use `returning` when you also need other values, such as the ones the database filled in by itself. See [Insert returning](#insert-returning).

Some of these methods check the number of rows, and their promise rejects with a [`TsSqlError`](../api/error-management/library-raised-errors.md) with this reason when the check fails:

| Method | Reason | When |
|:-------|:-------|:-----|
| `executeInsertOne()` | `NO_RESULT` | No row was returned |
| `executeInsertOne()`, `executeInsertNoneOrOne()` | `MORE_THAN_ONE_ROW` | More than one row was returned |
| `executeInsert(min, max)`, `executeInsertMany(min, max)` | `MINIMUM_ROWS_NOT_REACHED` | Fewer rows than `min` were inserted |
| `executeInsert(min, max)`, `executeInsertMany(min, max)` | `MAXIMUM_ROWS_EXCEEDED` | More rows than `max` were inserted |

These checks are done with the answer of the database, so the insert has already been executed. To undo it when a check fails, run it in a [transaction](transaction.md).

### Availability per database

Using a method a database doesn't offer is a compilation error; the versions are the ones from which the database understands the SQL the library writes.

| | MariaDB | MySQL | Oracle | PostgreSQL | SQLite | SQL Server |
|:--|:--:|:--:|:--:|:--:|:--:|:--:|
| `returningLastInsertedId()`, one row | Yes | Yes | Yes | Yes | Yes | Yes |
| `returningLastInsertedId()`, several rows | 10.5+ | No | Yes | Yes | 3.35+ | Yes |
| `returningLastInsertedId()`, from a select | 10.5+ | No | No | Yes | 3.35+ | Yes |
| `returning` / `returningOneColumn`, one or several rows | 10.5+ | No | Yes | Yes | 3.35+ | Yes |
| `returning` / `returningOneColumn`, from a select | 10.5+ | No | No | Yes | 3.35+ | Yes |

## Insert returning

If you are using [PostgreSQL](../configuration/supported-databases/postgresql.md), modern [SQLite](../configuration/supported-databases/sqlite.md), [SQL Server](../configuration/supported-databases/sqlserver.md), modern [MariaDB](../configuration/supported-databases/mariadb.md) or [Oracle](../configuration/supported-databases/oracle.md) (except for an insert from select), you can return values of the inserted record in the same query using the `returning` or `returningOneColumn` methods. This returns what is stored in the row, also what you didn't send: the generated id or a default value, without a second query. `returning` receives an object like the one of a `select`.

```ts
const insertReturningCustomerData = connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    }).returning({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .executeInsertOne()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    insert into customer (first_name, last_name, company_id) 
    values (?, ?, ?) 
    returning 
        id as id, 
        first_name as firstName, 
        last_name as lastName
    ```
=== "MySQL"
    ```mysql
    --
    --
    -- MySQL doesn't support inserting returning values
    --
    --
    --
    ```
=== "Oracle"
    ```oracle
    insert into customer (first_name, last_name, company_id) 
    values (:0, :1, :2) 
    returning 
        id, 
        first_name, 
        last_name 
    into :3, :4, :5
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id) 
    values ($1, $2, $3) 
    returning 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName"
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id) 
    values (?1, ?2, ?3) 
    returning 
        id as id, 
        first_name as firstName, 
        last_name as lastName
    ```
=== "SQL Server"
    ```sqlserver
    insert into customer (first_name, last_name, company_id) 
    output 
        inserted.id as id, 
        inserted.first_name as firstName, 
        inserted.last_name as lastName 
    values (@0, @1, @2)
    ```

The parameters are: `[ 'John', 'Smith', 1 ]` (On [Oracle](../configuration/supported-databases/oracle.md), output parameters are added at the corresponding position with the structure `{dir:3003}`)

The result type is a promise with the information of the inserted rows:
```tsx
const insertReturningCustomerData: Promise<{
    id: number;
    firstName: string;
    lastName: string;
}>
```

**Other options**

You can project optional values in objects as always-required properties that allow null calling `projectingOptionalValuesAsNullable()` immediately after `returning(...)`.

You can execute the query using:

- `executeInsertNoneOrOne(): Promise<RESULT | null>`: Execute the insert query that returns one or no result from the database. In case of more than one result found an exception will be thrown.
- `executeInsertOne(): Promise<RESULT>`: Execute the insert query that returns one result from the database. If no result is returned by the database, or there is more than one, an exception will be thrown.
- `executeInsertMany(min?: number, max?: number): Promise<RESULT[]>`: Execute the insert query that returns zero or many results from the database.

Additionally, if you want to return the value of a single column, you can use `returningOneColumn(column)` instead of `returning({...})`; the result is the value, not an object:

```ts
const insertedFirstName = connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    })
    .returningOneColumn(tCustomer.firstName)
    .executeInsertOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    insert into customer (first_name, last_name, company_id)
    values (?, ?, ?)
    returning first_name as result
    ```
=== "MySQL"
    ```mysql
    -- MySQL doesn't support inserting returning values
    ```
=== "Oracle"
    ```oracle
    insert into customer (first_name, last_name, company_id)
    values (:0, :1, :2)
    returning first_name
    into :3
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id)
    values ($1, $2, $3)
    returning first_name as result
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id)
    values (?1, ?2, ?3)
    returning first_name as result
    ```
=== "SQL Server"
    ```sqlserver
    insert into customer (first_name, last_name, company_id)
    output inserted.first_name as result
    values (@0, @1, @2)
    ```

The parameters are: `[ 'John', 'Smith', 1 ]` (On [Oracle](../configuration/supported-databases/oracle.md), output parameters are added at the corresponding position with the structure `{dir:3003}`)

The result type is:
```tsx
const insertedFirstName: Promise<string>
```

## Manipulating values to insert

When the values come from outside (a request, a form, an import), you often need to adjust them before inserting: fill in what is missing, drop what the caller can't decide, or reject the input. These methods do it as part of the query, instead of with `if`s around it. They work on the values given so far, at the moment you call them, so the order of the calls matters. This is one of the [dynamic capabilities](../dynamic/building-blocks.md) of the library.

Two words decide what each method does:

- A column is **set** when the values include it, whatever its value is.
- A column **has a value** when it is set to something other than `null`, `undefined`, an empty string or an empty array. An empty string counts as a value when the connection has `allowEmptyString` set to `true`; by default it doesn't.

This is what each method does with a column, depending on its current state:

| Method | Column not set | Set, without a value | Set, with a value |
|:-------|:--:|:--:|:--:|
| `set` | Writes it | Writes it | Writes it |
| `setIfSet` | | Writes it | Writes it |
| `setIfNotSet` | Writes it | | |
| `setIfHasValue` | | | Writes it |
| `setIfHasNoValue` | Writes it | Writes it | |
| `ignoreIfSet` | | Removes it | Removes it |
| `ignoreIfHasValue` | | | Removes it |
| `ignoreIfHasNoValue` | | Removes it | |
| `disallowIfSet` | | Throws | Throws |
| `disallowIfNotSet` | Throws | | |
| `disallowIfValue` | | | Throws |
| `disallowIfNoValue` | Throws | Throws | |

Three methods look at the columns you don't list, or at all of them:

- `keepOnly` removes every column except the listed ones.
- `ignoreAnySetWithNoValue` removes every column that is set without a value.
- `disallowAnyOtherSet` throws if a column other than the listed ones is set. A property that isn't a column of the table doesn't count.

Each `set...` method has a twin that also looks at the new value: `setIfValue`, `setIfSetIfValue`, `setIfNotSetIfValue`, `setIfHasValueIfValue` and `setIfHasNoValueIfValue` do the same as the method they are named after, but skip the column when the new value has no value. And every method has a `When` variant, whose first argument says whether to do it: `setWhen(condition, {...})`.

### When to use each one

| You want to | Use |
|:------------|:----|
| Write only the values that were provided, and leave the rest to the database | `setIfValue` |
| Remove the columns that came without a value | `ignoreAnySetWithNoValue`, or `ignoreIfHasNoValue` for some columns |
| Give a value when the column wasn't provided | `setIfNotSet` |
| Give a value when the column wasn't provided or came without a value | `setIfHasNoValue` |
| Replace what was provided, without adding the column if it wasn't | `setIfSet`, or `setIfHasValue` if it must also have a value |
| Remove a column the caller can't decide | `ignoreIfSet` |
| Accept only a list of columns, silently | `keepOnly` |
| Accept only a list of columns, rejecting anything else | `disallowAnyOtherSet` |
| Reject a column the caller can't decide | `disallowIfSet`, or `disallowIfValue` to accept it when it comes without a value |
| Reject the input when a column is missing | `disallowIfNotSet`, or `disallowIfNoValue` if it must also have a value |

For example, the values of a new customer arrive in a request: the id is ignored because the database generates it, a birthday without a value isn't written, and the first name is mandatory.

```ts
const received = {
    id: 99,
    firstName: 'John',
    lastName: 'Smith',
    companyId: 1,
    birthday: null
};

const customerId = await connection.insertInto(tCustomer)
    .set(received)
    .ignoreIfSet('id')
    .ignoreIfHasNoValue('birthday')
    .disallowIfNoValue('The first name is mandatory', 'firstName')
    .returningLastInsertedId()
    .executeInsert();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    insert into customer (first_name, last_name, company_id)
    values (?, ?, ?)
    returning id
    ```
=== "MySQL"
    ```mysql
    insert into customer (first_name, last_name, company_id)
    values (?, ?, ?)
    -- Last inserted ID returned by the database got from the connection
    ```
=== "Oracle"
    ```oracle
    insert into customer (first_name, last_name, company_id)
    values (:0, :1, :2)
    returning id
    into :3
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id)
    values ($1, $2, $3)
    returning id
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id)
    values (?1, ?2, ?3)
    returning id
    ```
=== "SQL Server"
    ```sqlserver
    insert into customer (first_name, last_name, company_id)
    output inserted.id
    values (@0, @1, @2)
    ```

The parameters are: `[ 'John', 'Smith', 1 ]` (On [Oracle](../configuration/supported-databases/oracle.md), output parameters are added at the corresponding position with the structure `{dir:3003}`)

The result type is:
```tsx
const customerId: number
```

The `disallow...` methods throw at the moment you call them, before anything reaches the database: the error you passed, or, with a message, a [`TsSqlProcessingError`](../api/error-management/library-raised-errors.md) with the reason `DISALLOWED_BY_QUERY_RULE` that tells which property it was. They are for rules of your application; the database still checks its own.

The types follow what you do: removing a required column with `ignoreIfSet` or `keepOnly` is a compilation error at the execute method, until you set that column again. With a [shape](shapes.md), the methods use the names of the shape.

In the methods that receive names of columns, the name of a [group of columns](../configuration/mapping.md#grouping-columns) means all its columns, and the path of a column in a group means that column: `ignoreIfSet('ubication')`, `keepOnly('name', 'ubication.comment')`. A group without value counts as all its columns without value: `setIfValue({ ubication: null })` writes none of them.

### All the methods

When you write your insert query, you set the initial value calling:

<!-- doc-code-snippet-template: simplifiedDefinitionInQuery -->
```ts
interface InsertExpression {
    /** Alias to set method: Set the values for insert */
    values(columns: InsertSets): this
    set(columns: InsertSets): this
    dynamicSet(): this
    dynamicSet(columns: OptionalInsertSets): this
     /** Alias to dynamicSet method: Allows to set the values dynamically */
    dynamicValues(columns: OptionalInsertSets): this
}
```

The `set` and `values` methods will require you to provide a value at least for the required fields. The `dynamicSet` and `dynamicValues` methods allow you to start the insert with optional values even when required in the insert; or even with no values at all. `ts-sql-query` will track all missing properties, and you will get a compilation error if one of them is missed (you will not be able to call the execute methods).

When you set the initial value, you can start manipulating them using the following methods:

<!-- doc-code-snippet-template: simplifiedDefinitionInQuery -->
```ts
interface InsertExpression {
    /** 
     * Set the values for insert.
     */
    set(columns: InsertSets): this
    /** 
     * Set a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     */
    setIfValue(columns: OptionalInsertSets): this
    /** 
     * Set a previous set value only.
     */
    setIfSet(columns: InsertSets): this
    /** 
     * Set a previous set value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     */
    setIfSetIfValue(columns: OptionalInsertSets): this
    /** 
     * Set a value only if it was not previously set.
     */
    setIfNotSet(columns: InsertSets): this
    /** 
     * Set a unset value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     * (only if the value was not previously set).
     */
    setIfNotSetIfValue(columns: OptionalInsertSets): this

    /** 
     * Set a value for the specified columns that was previously indicated a value for set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     */
    setIfHasValue(columns: InsertSets): this
    /** 
     * Set a value for the specified columns that was previously indicated a value for 
     * set only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     */
    setIfHasValueIfValue(columns: OptionalInsertSets): this
    /** 
     * Set a value for the specified columns that has not value to set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     */
    setIfHasNoValue(columns: InsertSets): this
    /** 
     * Set a value for the specified columns that has no value to set 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     */
    setIfHasNoValueIfValue(columns: OptionalInsertSets): this

    
    /** 
     * Unset the listed columns previous set.
     * */
    ignoreIfSet(...columns: string[]): this
    /** 
     * Keep only the listed columns previous set.
     */
    keepOnly(...columns: string[]): this
    /** 
     * Unset the listed columns if they have a value to set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     */
    ignoreIfHasValue(...columns: string[]): this
    /** 
     * Unset the listed columns if them has no value to set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     */
    ignoreIfHasNoValue(...columns: string[]): this
    /** 
     * Unset all columns that was set with no value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     */
    ignoreAnySetWithNoValue(): this

    /**
     * Throw an error if the indicated properties are set
     */
    disallowIfSet(errorMessage: string, ...columns: string[]): this
    disallowIfSet(error: Error, ...columns: string[]): this
    /**
     * Throw an error if the indicated properties are not set
     */
    disallowIfNotSet(errorMessage: string, ...columns: string[]): this
    disallowIfNotSet(error: Error, ...columns: string[]): this
    /**
     * Throw an error if the indicated properties was set with a value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfValue(errorMessage: string, ...columns: string[]): this
    disallowIfValue(error: Error, ...columns: string[]): this
    /**
     * Throw an error if the indicated properties was set not set or has no value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfNoValue(errorMessage: string, ...columns: string[]): this
    disallowIfNoValue(error: Error, ...columns: string[]): this
    /**
     * Throw an error if any column other than the ones listed is set
     */
    disallowAnyOtherSet(errorMessage: string, ...columns: string[]): this
    disallowAnyOtherSet(error: Error, ...columns: string[]): this
}
```

All these methods have a `When` variant that allows you to specify as the first argument a boolean that, when it is true, the action will be executed. Like: `setWhen(when: boolean, columns: InsertSets): this`

For example, a customer without a company of their own is assigned the default one:

```ts
const assignTheDefaultCompany = true;

const insertedCount = await connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 2
    })
    .setWhen(assignTheDefaultCompany, { companyId: 1 })
    .executeInsert();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    insert into customer (first_name, last_name, company_id)
    values (?, ?, ?)
    ```
=== "MySQL"
    ```mysql
    insert into customer (first_name, last_name, company_id)
    values (?, ?, ?)
    ```
=== "Oracle"
    ```oracle
    insert into customer (first_name, last_name, company_id)
    values (:0, :1, :2)
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id)
    values ($1, $2, $3)
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id)
    values (?1, ?2, ?3)
    ```
=== "SQL Server"
    ```sqlserver
    insert into customer (first_name, last_name, company_id)
    values (@0, @1, @2)
    ```

The parameters are: `[ 'John', 'Smith', 1 ]`

The result type is:
```tsx
const insertedCount: number
```

!!! warning "A `When` variant doesn't set a required column"

    The condition is only known when the query runs, so for the types a `When` variant may not happen: setting a required column only through `setWhen(...)` (or any other `When` variant) leaves it missing, and the insert can't be executed. Set the required columns with `set(...)` (or `dynamicSet(...)` followed by `set(...)`), and use the `When` variants to change them.

## Manipulating the values of several rows

An insert of several rows has the same methods as [one row](#manipulating-values-to-insert), with the same meaning, but they apply to all the rows, each row on its own: `setForAllIfSet` changes the rows that have the column set and leaves the others as they are. The methods that give new values are called `setForAll...`, because `set` isn't available after `values([...])`; the ones that remove or reject columns keep their names. When a `disallow...` method fails, the error also tells which row it was (`disallowedRowIndex`).

When you write your insert query, you set the initial value calling:

<!-- doc-code-snippet-template: simplifiedDefinitionInQuery -->
```ts
interface InsertExpression {
    values(columns: InsertSets[]): this
    dynamicValues(columns: OptionalInsertSets[]): this
}
```

The `values` method will require you to provide a value at least for the required fields. The `dynamicValues` method allows you to start the insert with optional values even when required in the insert; or even with no values at all. `ts-sql-query` will track all missing properties, and you will get a compilation error if one of them is missed (you will not be able to call the execute methods).

When you set the initial value, you can start manipulating them (all at the same time, with same new values) using the following methods:

<!-- doc-code-snippet-template: simplifiedDefinitionInQuery -->
```ts
interface InsertExpression {
    /** 
     * Set the values for insert 
     */
    setForAll(columns: InsertSets): this
    /** 
     * Set a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setForAllIfValue(columns: OptionalInsertSets): this
    /** 
     * Set a previous set value only 
     */
    setForAllIfSet(columns: InsertSets): this
    /** 
     * Set a previous set value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setForAllIfSetIfValue(columns: OptionalInsertSets): this
    /** 
     * Set a unset value (only if the value was not previously set) 
     */
    setForAllIfNotSet(columns: InsertSets): this
    /** 
     * Set a unset value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     * (only if the value was not previously set) 
     */
    setForAllIfNotSetIfValue(columns: OptionalInsertSets): this

    /** 
     * Set a value for the specified columns that was previously indicated a value for set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasValue(columns: InsertSets): this
    /** 
     * Set a value for the specified columns that was previously indicated a value for 
     * set only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasValueIfValue(columns: OptionalInsertSets): this
    /** 
     * Set a value for the specified columns that has not value to set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasNoValue(columns: InsertSets): this
    /** 
     * Set a value for the specified columns that has no value to set 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasNoValueIfValue(columns: OptionalInsertSets): this

    /** 
     * Unset the listed columns previous set.
     * */
    ignoreIfSet(...columns: string[]): this
    /** 
     * Keep only the listed columns previous set.
     */
    keepOnly(...columns: string[]): this
    /** 
     * Unset the listed columns if they have a value to set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     */
    ignoreIfHasValue(...columns: string[]): this
    /** 
     * Unset the listed columns if them has no value to set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     */
    ignoreIfHasNoValue(...columns: string[]): this
    /** 
     * Unset all columns that was set with no value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     */
    ignoreAnySetWithNoValue(): this

    /**
     * Throw an error if the indicated properties are set
     */
    disallowIfSet(errorMessage: string, ...columns: string[]): this
    disallowIfSet(error: Error, ...columns: string[]): this
    /**
     * Throw an error if the indicated properties are not set
     */
    disallowIfNotSet(errorMessage: string, ...columns: string[]): this
    disallowIfNotSet(error: Error, ...columns: string[]): this
    /**
     * Throw an error if the indicated properties was set with a value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfValue(errorMessage: string, ...columns: string[]): this
    disallowIfValue(error: Error, ...columns: string[]): this
    /**
     * Throw an error if the indicated properties was set not set or has no value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfNoValue(errorMessage: string, ...columns: string[]): this
    disallowIfNoValue(error: Error, ...columns: string[]): this
    /**
     * Throw an error if any column other than the ones listed is set
     */
    disallowAnyOtherSet(errorMessage: string, ...columns: string[]): this
    disallowAnyOtherSet(error: Error, ...columns: string[]): this
}
```

All these methods have a `When` variant that allows you to specify as the first argument a boolean that, when it is true, the action will be executed. Like: `setForAllWhen(when: boolean, columns: InsertSets): this`

For example, every customer inserted is assigned the default company when the import says so:

```ts
const assignTheDefaultCompany = true;

const insertedCount = await connection.insertInto(tCustomer).values([
        { firstName: 'John', lastName: 'Smith', companyId: 2 },
        { firstName: 'Jane', lastName: 'Doe', companyId: 3 }
    ])
    .setForAllWhen(assignTheDefaultCompany, { companyId: 1 })
    .executeInsert();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    insert into customer (first_name, last_name, company_id)
    values (?, ?, ?), (?, ?, ?)
    ```
=== "MySQL"
    ```mysql
    insert into customer (first_name, last_name, company_id)
    values (?, ?, ?), (?, ?, ?)
    ```
=== "Oracle"
    ```oracle
    begin
        insert into customer (first_name, last_name, company_id)
        values (:0, :1, :2);
        insert into customer (first_name, last_name, company_id)
        values (:3, :4, :5);
    end;
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id)
    values ($1, $2, $3), ($4, $5, $6)
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id)
    values (?1, ?2, ?3), (?4, ?5, ?6)
    ```
=== "SQL Server"
    ```sqlserver
    insert into customer (first_name, last_name, company_id)
    values (@0, @1, @2), (@3, @4, @5)
    ```

The parameters are: `[ 'John', 'Smith', 1, 'Jane', 'Doe', 1 ]`

The result type is:
```tsx
const insertedCount: number
```

## Insert with a shape

The values to insert can have other property names than the columns of the table, using a shape: see [Insert and update with a shape](shapes.md).

## Insert on conflict

What an insert can do when the row conflicts with an existing one (do nothing, or update the existing row: an "upsert") has its own page: [Insert on conflict ("upsert")](insert-on-conflict.md).

## Other options

`query()` and `params()` give you the SQL and the parameters of an insert without executing it, and `customizeQuery(...)` adds SQL fragments to it: see [Customizing an insert](sql-fragments.md#customizing-an-insert).
