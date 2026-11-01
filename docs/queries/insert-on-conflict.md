---
search:
  boost: 4
---
# Insert on conflict ("upsert")

This page explains what an `INSERT` can do when the row conflicts with an existing one (a unique key or a unique index): do nothing, or update the existing row instead (an "upsert"). [PostgreSQL](../configuration/supported-databases/postgresql.md), [SQLite](../configuration/supported-databases/sqlite.md), [MariaDB](../configuration/supported-databases/mariadb.md) and [MySQL](../configuration/supported-databases/mysql.md) support it; [Oracle](../configuration/supported-databases/oracle.md) and [SQL Server](../configuration/supported-databases/sqlserver.md) don't. For the rest of the insert, see [Insert](insert.md).

## The on conflict methods

The clause is added to an insert with one of these methods, after setting the values to insert:

<!-- doc-code-snippet-template: simplifiedDefinitionInQuery -->
```ts
interface InsertExpression {
    /** Do nothing when the row conflicts with any unique key (PostgreSQL, SQLite, MariaDB, MySQL) */
    onConflictDoNothing(): this
    /** Update the existing row when the row conflicts with any unique key (SQLite, MariaDB, MySQL) */
    onConflictDoUpdateSet(columns: UpdateSets): this
    /** 
     * Like onConflictDoUpdateSet, but a value is only updated if it is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array (SQLite, MariaDB, MySQL)
     */
    onConflictDoUpdateSetIfValue(columns: UpdateSets): this
    /** Start the update with these values, or with none, to add them later (SQLite, MariaDB, MySQL) */
    onConflictDoUpdateDynamicSet(): this
    onConflictDoUpdateDynamicSet(columns: UpdateSets): this
    /** Choose the conflict that is handled: the columns of a unique key or a unique index (PostgreSQL, SQLite) */
    onConflictOn(column: AnyValueSource, ...columns: AnyValueSource[]): this
    /** Choose the conflict that is handled: the name of a unique constraint (PostgreSQL) */
    onConflictOnConstraint(constraint: RawFragment): this
}
```

Once the conflict is chosen with `onConflictOn` or `onConflictOnConstraint`, what to do is given with these methods:

<!-- doc-code-snippet-template: simplifiedDefinitionInQuery -->
```ts
interface InsertOnConflictExpression {
    /** 
     * The condition of a partial unique index, so the database can pick it 
     * (only right after onConflictOn)
     */
    where(condition: BooleanValueSource): this
    /** Do nothing */
    doNothing(): this
    /** Update the existing row */
    doUpdateSet(columns: UpdateSets): this
    /** Update the existing row, only with the values that have a value (like onConflictDoUpdateSetIfValue) */
    doUpdateSetIfValue(columns: UpdateSets): this
    /** Start the update with these values, or with none, to add them later */
    doUpdateDynamicSet(): this
    doUpdateDynamicSet(columns: UpdateSets): this
}
```

After an update, on PostgreSQL and SQLite, a condition decides which conflicting rows are updated; it can use the existing row (the table) and the values to insert, which the table gives with `valuesForInsert()`:

<!-- doc-code-snippet-template: simplifiedDefinitionInQuery -->
```ts
interface InsertOnConflictDoUpdateExpression {
    /** The condition the conflicting row must meet to be updated (PostgreSQL, SQLite) */
    where(condition: BooleanValueSource): this
    /** Allows to create the where dynamically */
    dynamicWhere(): this
    /** Allows to extend the where using an and */
    and(condition: BooleanValueSource): this
    /** Allows to extend the where using an or */
    or(condition: BooleanValueSource): this
}
```

An update started with `onConflictDoUpdateDynamicSet` or `doUpdateDynamicSet` takes its values with the same methods an update has (`set`, `setIfValue`, `ignoreIfSet`, …), described in [Manipulating values to update](update.md#manipulating-values-to-update). The sections below show each of these methods.

## Do nothing

If you are using [PostgreSQL](../configuration/supported-databases/postgresql.md), [SQLite](../configuration/supported-databases/sqlite.md), [MariaDB](../configuration/supported-databases/mariadb.md) or [MySQL](../configuration/supported-databases/mysql.md) you can specify the insert must do nothing in case of conflict.

```ts
const insertReturningCustomerData = connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    })
    .onConflictDoNothing()
    .returning({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .executeInsertNoneOrOne()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    -- Pay attention to the `ignore` keyword after `insert`
    insert ignore into customer (first_name, last_name, company_id) 
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
    --
    -- MySQL doesn't support inserting returning values
    --
    --
    --
    ```
=== "Oracle"
    ```oracle
    --
    --
    --
    -- Oracle doesn't support insert on conflict do nothing
    --
    --
    --
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id) 
    values ($1, $2, $3) 
    on conflict do nothing 
    returning 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName"
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id) 
    values (?1, ?2, ?3) 
    on conflict do nothing 
    returning 
        id as id, 
        first_name as firstName, 
        last_name as lastName
    ```
=== "SQL Server"
    ```sqlserver
    --
    --
    --
    -- SQL Server doesn't support insert on conflict do nothing
    --
    --
    --
    ```

The parameters are: `[ 'John', 'Smith', 1 ]`

The result type is a promise with the information of the inserted rows:
```tsx
const insertReturningCustomerData: Promise<{
    id: number;
    firstName: string;
    lastName: string;
} | null>
```

!!! note

    - On [PostgreSQL](../configuration/supported-databases/postgresql.md) and [SQLite](../configuration/supported-databases/sqlite.md), you can specify the columns that can create the conflict (including a `where` clause for that columns).
    - On [PostgreSQL](../configuration/supported-databases/postgresql.md) you can specify the constraint name that raise the conflict.
    - You can combine this with other insert's features, e.g. return some columns.

## What is returned when nothing is inserted

When the conflict makes the insert do nothing, no row is inserted: `executeInsert()` returns `0`, `returningLastInsertedId()` returns `null` instead of the id, and a `returning(...)` gives no row (use `executeInsertNoneOrOne()`, as in the example of [Insert on conflict do nothing](#do-nothing)). On MySQL and MariaDB the conflict makes the insert an `insert ignore`; MySQL doesn't offer `returningLastInsertedId()` after an on conflict clause, so there `executeInsert()` (the number of inserted rows) tells whether the row was inserted.

```ts
const insertedId = await connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    })
    .onConflictDoNothing()
    .returningLastInsertedId()
    .executeInsert();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    insert ignore into customer (first_name, last_name, company_id)
    values (?, ?, ?)
    returning id
    ```
=== "MySQL"
    ```mysql
    -- MySQL doesn't offer returningLastInsertedId() after an on conflict clause:
    -- use executeInsert(), which returns 0 when the row is skipped
    ```
=== "Oracle"
    ```oracle
    -- Oracle doesn't support insert on conflict
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id)
    values ($1, $2, $3)
    on conflict do nothing
    returning id
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id)
    values (?1, ?2, ?3)
    on conflict do nothing
    returning id
    ```
=== "SQL Server"
    ```sqlserver
    -- SQL Server doesn't support insert on conflict
    ```

The parameters are: `[ 'John', 'Smith', 1 ]`

The result type is:
```tsx
const insertedId: number | null
```

## Update the existing row ("upsert")

[PostgreSQL](../configuration/supported-databases/postgresql.md), [SQLite](../configuration/supported-databases/sqlite.md), [MariaDB](../configuration/supported-databases/mariadb.md) and [MySQL](../configuration/supported-databases/mysql.md) support specifying that an `INSERT` must do an update in case of conflict (also known as an "upsert"). The shape of the call depends on the engine:

- On **MariaDB** and **MySQL** the update fires on any unique-key violation; you don't specify which one. Use the bare `.onConflictDoUpdateSet({...})`.
- On **PostgreSQL** you must say which unique-key column or constraint triggers the update. Use `.onConflictOn(...)` (or `.onConflictOnConstraint(connection.rawFragment\`...\`)`) chained with `.doUpdateSet({...})`.
- **SQLite** accepts both forms.
- **Oracle** and **SQL Server** don't support this syntax.

=== "MariaDB"
    ```ts
    const insertReturningCustomerData = await connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictDoUpdateSet({    // any unique-key violation triggers the update
            companyId: 1
        })
        .returning({
            id: tCustomer.id,
            firstName: tCustomer.firstName,
            lastName: tCustomer.lastName
        })
        .executeInsertOne()
    ```
=== "MySQL"
    ```ts
    //
    //
    // MySQL doesn't support inserting returning values
    // use .executeInsert() (returns the affected-row count) instead
    // in similar way as MariaDB.
    //
    //
    ```
=== "Oracle"
    ```ts
    //
    //
    //
    // Oracle doesn't support insert on conflict do update.
    //
    //
    //
    ```
===+ "PostgreSQL"
    ```ts
    const insertReturningCustomerData = await connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictOn(tCustomer.id) // PostgreSQL requires an explicit conflict target
        .doUpdateSet({
            companyId: 1
        })
        .returning({
            id: tCustomer.id,
            firstName: tCustomer.firstName,
            lastName: tCustomer.lastName
        })
        .executeInsertOne()
    ```
=== "SQLite"
    ```ts
    const insertReturningCustomerData = await connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictOn(tCustomer.id) // both forms accepted; the targeted form ports to PostgreSQL
        .doUpdateSet({
            companyId: 1
        })
        .returning({
            id: tCustomer.id,
            firstName: tCustomer.firstName,
            lastName: tCustomer.lastName
        })
        .executeInsertOne()
    ```
=== "SQL Server"
    ```ts
    //
    //
    //
    // SQL Server doesn't support insert on conflict do update.
    //
    //
    //
    ```

The executed query is:

=== "MariaDB"
    ```mariadb
    insert into customer (first_name, last_name, company_id) 
    values (?, ?, ?) 
    on duplicate key update company_id = ? 
    returning 
        id as id, 
        first_name as firstName, 
        last_name as lastName
    ```
=== "MySQL"
    ```mysql
    --
    --
    --
    -- MySQL doesn't support inserting returning values
    --
    --
    --
    ```
=== "Oracle"
    ```oracle
    --
    --
    --
    -- Oracle doesn't support insert on conflict do update
    --
    --
    --
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id) 
    values ($1, $2, $3) 
    on conflict (id) do update set company_id = $4 
    returning 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName"
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id) 
    values (?1, ?2, ?3) 
    on conflict (id) do update set company_id = ?4 
    returning 
        id as id, 
        first_name as firstName, 
        last_name as lastName
    ```
=== "SQL Server"
    ```sqlserver
    --
    --
    --
    -- SQL Server doesn't support insert on conflict do update
    --
    --
    --
    ```

The parameters are: `[ 'John', 'Smith', 1, 1 ]`

The result type is a promise with the information of the inserted rows:
```tsx
const insertReturningCustomerData: Promise<{
    id: number;
    firstName: string;
    lastName: string;
}>
```

If you want to use in the update the values to insert you can call them method `valuesForInsert()` over the table to get access to the table representation of the values to insert. On PostgreSQL and SQLite you can also use them in the `.where(...)` that follows `.doUpdateSet(...)`, to decide whether the conflicting row is updated.

=== "MariaDB"
    ```ts
    const tCustomerForInsert = tCustomer.valuesForInsert()
    const insertReturningCustomerData = await connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictDoUpdateSet({    // any unique-key violation triggers the update
            firstName: tCustomer.firstName.concat(' - ').concat(tCustomerForInsert.firstName),
            lastName:  tCustomer.lastName.concat(' - ').concat(tCustomerForInsert.lastName)
        })
        .returning({
            id: tCustomer.id,
            firstName: tCustomer.firstName,
            lastName: tCustomer.lastName
        })
        .executeInsertOne()
    ```
=== "MySQL"
    ```ts
    //
    //
    // MySQL doesn't support inserting returning values
    // use .executeInsert() (returns the affected-row count) instead
    // in similar way as MariaDB.
    //
    //
    ```
=== "Oracle"
    ```ts
    //
    //
    //
    // Oracle doesn't support insert on conflict do update.
    //
    //
    //
    ```
===+ "PostgreSQL"
    ```ts
    const tCustomerForInsert = tCustomer.valuesForInsert()
    const insertReturningCustomerData = await connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictOn(tCustomer.id) // PostgreSQL requires an explicit conflict target
        .doUpdateSet({
            firstName: tCustomer.firstName.concat(' - ').concat(tCustomerForInsert.firstName),
            lastName:  tCustomer.lastName.concat(' - ').concat(tCustomerForInsert.lastName)
        })
        .returning({
            id: tCustomer.id,
            firstName: tCustomer.firstName,
            lastName: tCustomer.lastName
        })
        .executeInsertOne()
    ```
=== "SQLite"
    ```ts
    const tCustomerForInsert = tCustomer.valuesForInsert()
    const insertReturningCustomerData = await connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictOn(tCustomer.id) // both forms accepted; the targeted form ports to PostgreSQL
        .doUpdateSet({
            firstName: tCustomer.firstName.concat(' - ').concat(tCustomerForInsert.firstName),
            lastName:  tCustomer.lastName.concat(' - ').concat(tCustomerForInsert.lastName)
        })
        .returning({
            id: tCustomer.id,
            firstName: tCustomer.firstName,
            lastName: tCustomer.lastName
        })
        .executeInsertOne()
    ```
=== "SQL Server"
    ```ts
    //
    //
    //
    // SQL Server doesn't support insert on conflict do update.
    //
    //
    //
    ```

The executed query is:

=== "MariaDB"
    ```mariadb
    insert into customer (first_name, last_name, company_id) 
    values (?, ?, ?) 
    on duplicate key update 
        first_name = concat(first_name, ?, value(first_name)), 
        last_name = concat(last_name, ?, value(last_name)) 
    returning 
        id as id, 
        first_name as firstName, 
        last_name as lastName
    ```
=== "MySQL"
    ```mysql
    --
    --
    --
    --
    -- MySQL doesn't support inserting returning values
    --
    --
    --
    --
    ```
=== "Oracle"
    ```oracle
    --
    --
    --
    --
    -- Oracle doesn't support insert on conflict do update
    --
    --
    --
    --
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id) 
    values ($1, $2, $3) 
    on conflict (id) do update set 
        first_name = customer.first_name || $4 || excluded.first_name, 
        last_name = customer.last_name || $5 || excluded.last_name 
    returning 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName"
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id) 
    values (?1, ?2, ?3) 
    on conflict (id) do update set 
        first_name = customer.first_name || ?4 || excluded.first_name, 
        last_name = customer.last_name || ?5 || excluded.last_name 
    returning 
        id as id, 
        first_name as firstName, 
        last_name as lastName
    ```
=== "SQL Server"
    ```sqlserver
    --
    --
    --
    --
    -- SQL Server doesn't support insert on conflict do update
    --
    --
    --
    --
    ```

The parameters are: `[ 'John', 'Smith', 1, ' - ', ' - ' ]`

The result type is a promise with the information of the inserted rows:
```tsx
const insertReturningCustomerData: Promise<{
    id: number;
    firstName: string;
    lastName: string;
}>
```

!!! note

    - On [PostgreSQL](../configuration/supported-databases/postgresql.md) and [SQLite](../configuration/supported-databases/sqlite.md) you can choose the conflict the clause handles, including a partial unique index, and on PostgreSQL a named constraint (see [Choosing the conflict](#choosing-the-conflict)), and decide with a `where` which conflicting rows are updated (see [Updating only some of the conflicting rows](#updating-only-some-of-the-conflicting-rows)).
    - The update can also skip the values that have no value ([Updating only the values that have a value](#updating-only-the-values-that-have-a-value)) or be built dynamically ([Building the update dynamically](#building-the-update-dynamically)).
    - You can combine any of these forms with other insert features, e.g. return some columns.

## Choosing the conflict

On [PostgreSQL](../configuration/supported-databases/postgresql.md) and [SQLite](../configuration/supported-databases/sqlite.md) you can say which conflict the clause handles; any other conflict still raises an error. On [MariaDB](../configuration/supported-databases/mariadb.md) and [MySQL](../configuration/supported-databases/mysql.md) the clause handles any unique-key violation, so there is nothing to choose.

### Doing nothing for a specific conflict

`onConflictOn(...)` receives the columns of the unique key (or unique index) whose conflict is handled, and `doNothing()` skips the insert for it.

```ts
const insertedCount = await connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    })
    .onConflictOn(tCustomer.firstName, tCustomer.lastName)
    .doNothing()
    .executeInsert();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    -- MariaDB doesn't let you choose the conflict: use onConflictDoNothing() / onConflictDoUpdateSet(...)
    ```
=== "MySQL"
    ```mysql
    -- MySQL doesn't let you choose the conflict: use onConflictDoNothing() / onConflictDoUpdateSet(...)
    ```
=== "Oracle"
    ```oracle
    -- Oracle doesn't support insert on conflict
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id)
    values ($1, $2, $3)
    on conflict (first_name, last_name) do nothing
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id)
    values (?1, ?2, ?3)
    on conflict (first_name, last_name) do nothing
    ```
=== "SQL Server"
    ```sqlserver
    -- SQL Server doesn't support insert on conflict
    ```

The parameters are: `[ 'John', 'Smith', 1 ]`

The result type is:
```tsx
const insertedCount: number
```

### A conflict on a partial unique index

When the unique index is partial (it only covers the rows that match a condition), the `where` that follows `onConflictOn(...)` gives that condition, so the database can pick the index.

```ts
const insertedCount = await connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    })
    .onConflictOn(tCustomer.firstName, tCustomer.lastName)
    .where(tCustomer.companyId.equals(1))
    .doUpdateSet({
        birthday: new Date('1990-01-01')
    })
    .executeInsert();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    -- MariaDB doesn't let you choose the conflict: use onConflictDoNothing() / onConflictDoUpdateSet(...)
    ```
=== "MySQL"
    ```mysql
    -- MySQL doesn't let you choose the conflict: use onConflictDoNothing() / onConflictDoUpdateSet(...)
    ```
=== "Oracle"
    ```oracle
    -- Oracle doesn't support insert on conflict
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id)
    values ($1, $2, $3)
    on conflict (first_name, last_name) where company_id = $4 do update set
        birthday = $5
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id)
    values (?1, ?2, ?3)
    on conflict (first_name, last_name) where company_id = ?4 do update set
        birthday = ?5
    ```
=== "SQL Server"
    ```sqlserver
    -- SQL Server doesn't support insert on conflict
    ```

The parameters are: `[ 'John', 'Smith', 1, 1, 1990-01-01T00:00:00.000Z ]`

The result type is:
```tsx
const insertedCount: number
```

### A conflict on a named constraint

On [PostgreSQL](../configuration/supported-databases/postgresql.md) the conflict can also be identified by the name of the unique constraint, with `onConflictOnConstraint(...)`. The name is an SQL identifier, not a value, so it is given as a [raw SQL fragment](sql-fragments.md); build it from what you know of the database, never from a string a user can influence.

```ts
const insertedCount = await connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    })
    .onConflictOnConstraint(connection.rawFragment`customer_name_key`)
    .doNothing()
    .executeInsert();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    -- MariaDB doesn't let you choose the conflict: use onConflictDoNothing() / onConflictDoUpdateSet(...)
    ```
=== "MySQL"
    ```mysql
    -- MySQL doesn't let you choose the conflict: use onConflictDoNothing() / onConflictDoUpdateSet(...)
    ```
=== "Oracle"
    ```oracle
    -- Oracle doesn't support insert on conflict
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id)
    values ($1, $2, $3)
    on conflict on constraint customer_name_key do nothing
    ```
=== "SQLite"
    ```sqlite
    -- SQLite doesn't support a conflict on a named constraint
    ```
=== "SQL Server"
    ```sqlserver
    -- SQL Server doesn't support insert on conflict
    ```

The parameters are: `[ 'John', 'Smith', 1 ]`

The result type is:
```tsx
const insertedCount: number
```

## Updating only some of the conflicting rows

On [PostgreSQL](../configuration/supported-databases/postgresql.md) and [SQLite](../configuration/supported-databases/sqlite.md) a `where` after `doUpdateSet(...)` decides whether the conflicting row is updated; the condition can use the existing row (the table) and the values to insert (`valuesForInsert()`). Here the row is only updated when the company changes:

```ts
const tCustomerForInsert = tCustomer.valuesForInsert();

const affectedCount = await connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    })
    .onConflictOn(tCustomer.firstName, tCustomer.lastName)
    .doUpdateSet({
        companyId: tCustomerForInsert.companyId
    })
    .where(tCustomer.companyId.notEquals(tCustomerForInsert.companyId))
    .executeInsert();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    -- MariaDB doesn't let you choose the conflict: use onConflictDoNothing() / onConflictDoUpdateSet(...)
    ```
=== "MySQL"
    ```mysql
    -- MySQL doesn't let you choose the conflict: use onConflictDoNothing() / onConflictDoUpdateSet(...)
    ```
=== "Oracle"
    ```oracle
    -- Oracle doesn't support insert on conflict
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id)
    values ($1, $2, $3)
    on conflict (first_name, last_name) do update set
        company_id = excluded.company_id
    where customer.company_id <> excluded.company_id
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id)
    values (?1, ?2, ?3)
    on conflict (first_name, last_name) do update set
        company_id = excluded.company_id
    where customer.company_id <> excluded.company_id
    ```
=== "SQL Server"
    ```sqlserver
    -- SQL Server doesn't support insert on conflict
    ```

The parameters are: `[ 'John', 'Smith', 1 ]`

The result type is:
```tsx
const affectedCount: number
```

## Updating only the values that have a value

`onConflictDoUpdateSetIfValue(...)` (and `doUpdateSetIfValue(...)` after choosing the conflict) only updates the columns whose value is not `null`, `undefined`, an empty string (unless the connection allows empty strings) or an empty array; the others keep their current value.

=== "MariaDB"
    ```ts
    const newBirthday: Date | null = null;
    
    const affectedCount = await connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictDoUpdateSetIfValue({
            companyId: 1,
            birthday: newBirthday // no value: not updated
        })
        .executeInsert();
    ```
=== "MySQL"
    ```ts
    const newBirthday: Date | null = null;
    
    const affectedCount = await connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictDoUpdateSetIfValue({
            companyId: 1,
            birthday: newBirthday // no value: not updated
        })
        .executeInsert();
    ```
=== "Oracle"
    ```ts
    //
    //
    // Oracle doesn't support insert on conflict do update.
    //
    //
    ```
===+ "PostgreSQL"
    ```ts
    const newBirthday: Date | null = null;
    
    const affectedCount = await connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictOn(tCustomer.id)
        .doUpdateSetIfValue({
            companyId: 1,
            birthday: newBirthday // no value: not updated
        })
        .executeInsert();
    ```
=== "SQLite"
    ```ts
    const newBirthday: Date | null = null;
    
    const affectedCount = await connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictOn(tCustomer.id)
        .doUpdateSetIfValue({
            companyId: 1,
            birthday: newBirthday // no value: not updated
        })
        .executeInsert();
    ```
=== "SQL Server"
    ```ts
    //
    //
    // SQL Server doesn't support insert on conflict do update.
    //
    //
    ```

The executed query is:

=== "MariaDB"
    ```mariadb
    insert into customer (first_name, last_name, company_id)
    values (?, ?, ?)
    on duplicate key update
        company_id = ?
    ```
=== "MySQL"
    ```mysql
    insert into customer (first_name, last_name, company_id)
    values (?, ?, ?)
    as _new_
    on duplicate key update
        customer.company_id = ?
    ```
=== "Oracle"
    ```oracle
    -- Oracle doesn't support insert on conflict
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id)
    values ($1, $2, $3)
    on conflict (id) do update set
        company_id = $4
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id)
    values (?1, ?2, ?3)
    on conflict (id) do update set
        company_id = ?4
    ```
=== "SQL Server"
    ```sqlserver
    -- SQL Server doesn't support insert on conflict
    ```

The parameters are: `[ 'John', 'Smith', 1, 1 ]`

The result type is:
```tsx
const affectedCount: number
```

## Building the update dynamically

`onConflictDoUpdateDynamicSet()` (and `doUpdateDynamicSet()` after choosing the conflict) starts the update with no values, so you can add them later with the same methods an update has (`set`, `setIfValue`, `ignoreIfSet`, … see [Manipulating values to update](update.md#manipulating-values-to-update)).

=== "MariaDB"
    ```ts
    const updateTheCompany = true;
    
    const query = connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictDoUpdateDynamicSet({
            lastName: 'Smith'
        });
    
    if (updateTheCompany) {
        query.set({ companyId: 1 });
    }
    
    const affectedCount = await query.executeInsert();
    ```
=== "MySQL"
    ```ts
    const updateTheCompany = true;
    
    const query = connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictDoUpdateDynamicSet({
            lastName: 'Smith'
        });
    
    if (updateTheCompany) {
        query.set({ companyId: 1 });
    }
    
    const affectedCount = await query.executeInsert();
    ```
=== "Oracle"
    ```ts
    //
    //
    // Oracle doesn't support insert on conflict do update.
    //
    //
    ```
===+ "PostgreSQL"
    ```ts
    const updateTheCompany = true;
    
    const query = connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictOn(tCustomer.id)
        .doUpdateDynamicSet({
            lastName: 'Smith'
        });
    
    if (updateTheCompany) {
        query.set({ companyId: 1 });
    }
    
    const affectedCount = await query.executeInsert();
    ```
=== "SQLite"
    ```ts
    const updateTheCompany = true;
    
    const query = connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: 1
        })
        .onConflictOn(tCustomer.id)
        .doUpdateDynamicSet({
            lastName: 'Smith'
        });
    
    if (updateTheCompany) {
        query.set({ companyId: 1 });
    }
    
    const affectedCount = await query.executeInsert();
    ```
=== "SQL Server"
    ```ts
    //
    //
    // SQL Server doesn't support insert on conflict do update.
    //
    //
    ```

The executed query is:

=== "MariaDB"
    ```mariadb
    insert into customer (first_name, last_name, company_id)
    values (?, ?, ?)
    on duplicate key update
        last_name = ?,
        company_id = ?
    ```
=== "MySQL"
    ```mysql
    insert into customer (first_name, last_name, company_id)
    values (?, ?, ?)
    as _new_
    on duplicate key update
        customer.last_name = ?,
        customer.company_id = ?
    ```
=== "Oracle"
    ```oracle
    -- Oracle doesn't support insert on conflict
    ```
===+ "PostgreSQL"
    ```postgresql
    insert into customer (first_name, last_name, company_id)
    values ($1, $2, $3)
    on conflict (id) do update set
        last_name = $4,
        company_id = $5
    ```
=== "SQLite"
    ```sqlite
    insert into customer (first_name, last_name, company_id)
    values (?1, ?2, ?3)
    on conflict (id) do update set
        last_name = ?4,
        company_id = ?5
    ```
=== "SQL Server"
    ```sqlserver
    -- SQL Server doesn't support insert on conflict
    ```

The parameters are: `[ 'John', 'Smith', 1, 'Smith', 1 ]`

The result type is:
```tsx
const affectedCount: number
```
