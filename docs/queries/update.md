---
search:
  boost: 4
---
# Update

An update changes the value of some columns in the rows of a table that meet a condition. The other rows, and the other columns of those rows, stay as they are. It's the way to do things like "this customer has a new last name", or "all the customers of this company move to another one".

Don't confuse it with an [insert](insert.md), which adds new rows, or with a [delete](delete.md), which removes whole rows: an update doesn't change the number of rows of the table. To insert a row or update it if it already exists, see [Update the existing row ("upsert")](insert-on-conflict.md#update-the-existing-row-upsert).

## Updating rows

`update` receives the table, `set` the new values, `where` the rows to change, and `executeUpdate` runs the query. In this example, `ignoreIfSet` takes the birthday out of the update: see [Manipulating values to update](#manipulating-values-to-update).

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

=== "MariaDB"
    ```mariadb
    update customer 
    set 
        first_name = ?, 
        last_name = ? 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    update customer 
    set 
        first_name = ?, 
        last_name = ? 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    update customer 
    set 
        first_name = :0, 
        last_name = :1 
    where id = :2
    ```
===+ "PostgreSQL"
    ```postgresql
    update customer 
    set 
        first_name = $1, 
        last_name = $2 
    where id = $3
    ```
=== "SQLite"
    ```sqlite
    update customer 
    set 
        first_name = ?1, 
        last_name = ?2 
    where id = ?3
    ```
=== "SQL Server"
    ```sqlserver
    update customer 
    set 
        first_name = @0, 
        last_name = @1 
    where id = @2
    ```

The parameters are: `[ 'John', 'Smith', 10 ]`

The result type is a promise with the number of updated rows:
```tsx
const updateCustomer: Promise<number>
```

Only the columns in `set` are written; computed and virtual columns can't be. If you call `set` more than once the values are added to the previous ones, and the last value of a column is the one that stays.

The value of a column can be:

- A value of the type of the column.
- An expression, to compute the new value from the current row, like `tCustomer.lastName.concat(' Jr.')`.
- `null` or `undefined`, on an optional column: the column ends up with no value.
- `connection.default()`, on a column with a default value: the column goes back to its default. It's not offered on [SQLite](../configuration/supported-databases/sqlite.md).

!!! danger "Security constraint"

    `ts-sql-query` rejects an update that ends without a `WHERE` clause. To update all the rows you must say so: see [Update without a where](#update-without-a-where).

## Update without a where

An update without a `where` changes all the rows of the table, and it's usually a mistake that is hard to undo. The library stops it in two moments:

- **When you compile:** `update(...)` doesn't offer the execute methods until you call `where` or `dynamicWhere`.
- **When you execute:** a condition can end up empty, for example a `dynamicWhere()` with no conditions added, or a `where` with only conditions that are [ignored because they have no value](dynamic-queries.md#optional-conditions-the-ifvalue-methods). The promise of the execute method then rejects with the reason `MISSING_WHERE`, and nothing is sent to the database.

When changing all the rows is what you want, start the query with `updateAllowingNoWhere` instead of `update`:

```ts
const updateAllCustomers = connection.updateAllowingNoWhere(tCustomer)
    .set({
        companyId: 1
    })
    .executeUpdate();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    update customer 
    set company_id = ?
    ```
=== "MySQL"
    ```mysql
    update customer 
    set company_id = ?
    ```
=== "Oracle"
    ```oracle
    update customer 
    set company_id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    update customer 
    set company_id = $1
    ```
=== "SQLite"
    ```sqlite
    update customer 
    set company_id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    update customer 
    set company_id = @0
    ```

The parameters are: `[ 1 ]`

The result type is a promise with the number of updated rows:
```tsx
const updateAllCustomers: Promise<number>
```

It only allows the `where` to be missing: if you add one, it's used as usual.

## The number of updated rows

`executeUpdate` returns the number of updated rows. When that number tells you something went wrong, like a row that had to exist and doesn't, give it a minimum and a maximum:

```ts
const updatedCount = await connection.update(tCustomer)
    .set({
        firstName: 'John'
    })
    .where(tCustomer.id.equals(10))
    .executeUpdate(1, 1);
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

With fewer rows than the minimum, the error has the reason `MINIMUM_ROWS_NOT_REACHED`; with more rows than the maximum, `MAXIMUM_ROWS_EXCEEDED`.

!!! warning

    The library compares the number after the database has executed the update, so the rows have already changed. If the error must undo them, run the update inside a [transaction](transaction.md).

## Update returning

`returning` makes the update give back data of the rows it has changed, in the same query, so you don't need a select afterwards. The columns of the table have their **new** value. It receives the same as a `select`, nested objects included, and `returningOneColumn(column)` returns the value of a single column instead of an object.

It isn't available on MySQL: see [Availability in each database](#availability-in-each-database).

```ts
const updatedSmithFirstName = connection.update(tCustomer)
    .set({
        firstName: 'Ron'
    })
    .where(tCustomer.id.equals(1))
    .returningOneColumn(tCustomer.firstName)
    .executeUpdateOne()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    update customer 
    set first_name = ? 
    where id = ? 
    returning first_name as result
    ```
=== "MySQL"
    ```mysql
    --
    --
    -- MySQL doesn't support update returning values
    --
    ```
=== "Oracle"
    ```oracle
    update customer 
    set first_name = :0 
    where id = :1 
    returning first_name 
    into :2
    ```
===+ "PostgreSQL"
    ```postgresql
    update customer 
    set first_name = $1 
    where id = $2 
    returning first_name as result
    ```
=== "SQLite"
    ```sqlite
    update customer 
    set first_name = ?1 
    where id = ?2 
    returning first_name as result
    ```
=== "SQL Server"
    ```sqlserver
    update customer 
    set first_name = @0 
    output inserted.first_name as [result] 
    where id = @1
    ```

The parameters are: `[ 'Ron', 1 ]` (On [Oracle](../configuration/supported-databases/oracle.md), output parameters are added at the corresponding position with the structure `{dir:3003}`)

The result type is a promise with the information of the updated rows:
```tsx
const updatedSmithFirstName: Promise<string>
```

**Other options**

You can project optional values in objects as always-required properties that allow null calling `projectingOptionalValuesAsNullable()` immediately after `returning(...)`.

With `returning` or `returningOneColumn` you execute the query with one of these methods, depending on how many rows you expect:

| Method | Returns | With no rows | With several rows |
|---|---|---|---|
| `executeUpdateNoneOrOne()` | The row or `null` | `null` | Error `MORE_THAN_ONE_ROW` |
| `executeUpdateOne()` | The row | Error `NO_RESULT` | Error `MORE_THAN_ONE_ROW` |
| `executeUpdateMany(min?, max?)` | An array of rows | An empty array | All the rows |

`min` and `max` in `executeUpdateMany` work as in [`executeUpdate`](#the-number-of-updated-rows). All these errors arrive when the database has already executed the update.

## Update returning old values

`returning` gives the values after the update. To also get the value a row had before it, without a select first, create a reference to the old values of the table by calling `myTable.oldValues()`, and use it in `returning`. It's useful, for example, to record what has changed. It's the only place that accepts it.

It isn't available on MySQL, Oracle or SQLite: see [Availability in each database](#availability-in-each-database).

```ts
const oldCustomerValues = tCustomer.oldValues()
const updatedLastNames = connection.update(tCustomer)
    .set({
        lastName: 'Thomson'
    })
    .where(tCustomer.id.equals(2))
    .returning({
        oldLastName: oldCustomerValues.lastName,
        newLastName: tCustomer.lastName
    })
    .executeUpdateOne()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    update customer 
    set last_name = ? 
    where id = ? 
    returning 
        old_value(last_name) as oldLastName, 
        last_name as newLastName
    ```
=== "MySQL"
    ```mysql
    --
    --
    --
    -- MySQL doesn't support update returning values
    --
    --
    ```
=== "Oracle"
    ```oracle
    --
    --
    --
    -- Oracle doesn't support update returning old values
    --
    --
    ```
===+ "PostgreSQL"
    ```postgresql
    update customer 
    set last_name = $1 
    where id = $2 
    returning 
        old.last_name as "oldLastName", 
        last_name as "newLastName"
    ```
=== "SQLite"
    ```sqlite
    --
    --
    --
    -- SQLite doesn't support update returning old values
    --
    --
    ```
=== "SQL Server"
    ```sqlserver
    update customer 
    set last_name = @0 
    output 
        deleted.last_name as oldLastName, 
        inserted.last_name as newLastName 
    where id = @1
    ```

The parameters are: `[ 'Thomson', 2 ]`

The result type is a promise with the information of the updated rows:
```tsx
const updatedLastNames: Promise<{
    oldLastName: string;
    newLastName: string;
}>
```

An old value is a value like any other, so you can use it inside an expression. There are two limits set by the database:

- On MariaDB, as of 13.0.2, an old value only works as a property on its own: inside a function the database returns the new value, and as the operand of an operator it rejects the query ([MDEV-40126](https://jira.mariadb.org/browse/MDEV-40126)).
- On SQL Server, `output` doesn't accept subqueries.

## Manipulating values to update

The values to update often arrive from outside the code, with some of them missing or not allowed for the current user. Instead of building the object by hand, these methods add missing values, take out undesired values, or throw an error when a value is present. This is one of the [dynamic capabilities](../dynamic/building-blocks.md) of the library.

When you write your update query, you set the initial value calling:

<!-- doc-code-snippet-template: simplifiedDefinitionInQuery -->
```ts
interface UpdateExpression {
    set(columns: UpdateSets): this
    dynamicSet(): this
    dynamicSet(columns: UpdateSets): this
}
```

`set` requires you to provide the values to update, and `dynamicSet` allows you to start with no values at all.

Several of these methods distinguish a column that **is set** from one that **has a value**. A column is set when a value was given for it, whichever it is. It has a value when that value isn't `null`, `undefined`, an empty array, or an empty string (an empty string counts as a value if the `allowEmptyString` flag of the connection is true).

The methods that set a value differ in what they do according to the current value of the column. Starting from `{ firstName: 'John', lastName: '' }`, with `birthday` not set, this happens to each column when one of these methods gives it a new value:

| Method | `firstName` (has a value) | `lastName` (set, with no value) | `birthday` (not set) |
|---|---|---|---|
| `set` | Replaced | Replaced | Set |
| `setIfSet` | Replaced | Replaced | Stays not set |
| `setIfNotSet` | Stays | Stays | Set |
| `setIfHasValue` | Replaced | Stays | Stays not set |
| `setIfHasNoValue` | Stays | Replaced | Set |

Each of them has a variant ending in `IfValue`, like `setIfValue` or `setIfNotSetIfValue`, that also skips the column when the **new** value has no value. Use it when only the values that arrived must be written:

```ts
const customerChanges: { firstName?: string, lastName?: string } = { firstName: 'John' };

const updatedCustomer = await connection.update(tCustomer)
    .setIfValue(customerChanges)
    .where(tCustomer.id.equals(10))
    .executeUpdate();
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

The result type is:
```tsx
const updatedCustomer: number
```

The other methods take columns out of the update (the `ignore` methods and `keepOnly`), or throw an error (the `disallow` methods). They look at the values set so far, so call them after the sets they must check. A `disallow` method throws when it's called, so the query is never sent. The error has the reason `DISALLOWED_BY_QUERY_RULE` and the column in `disallowedProperty`; if you give your own `Error` instead of a message, that one is thrown, also with `disallowedProperty`.

These are all the methods:

<!-- doc-code-snippet-template: simplifiedDefinitionInQuery -->
```ts
interface UpdateExpression {
    /** Set the values for update */
    set(columns: UpdateSets): this
    /** Set a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setIfValue(columns: OptionalUpdateSets): this
    /** Set a previous set value only */
    setIfSet(columns: UpdateSets): this
    /** Set a previous set value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     */
    setIfSetIfValue(columns: OptionalUpdateSets): this
    /** Set a value only if it was not previously set. */
    setIfNotSet(columns: UpdateSets): this
    /** 
     * Set a unset value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     * (only if the value was not previously set) 
     */
    setIfNotSetIfValue(columns: OptionalUpdateSets): this

    /** 
     * Set a value for the specified columns that was previously indicated a value for set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setIfHasValue(columns: UpdateSets): this
    /** 
     * Set a value for the specified columns that was previously indicated a value for 
     * set only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setIfHasValueIfValue(columns: OptionalUpdateSets): this
    /** 
     * Set a value for the specified columns that has not value to set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setIfHasNoValue(columns: UpdateSets): this
    /** 
     * Set a value for the specified columns that has no value to set 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setIfHasNoValueIfValue(columns: OptionalUpdateSets): this

    /** Unset the listed columns previous set */
    ignoreIfSet(...columns: string[]): this
    /** Keep only the listed columns previous set */
    keepOnly(...columns: string[]): this
    /** 
     * Unset the listed columns if they have a value to set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    ignoreIfHasValue(...columns: string[]): this
    /** 
     * Unset the listed columns if them has no value to set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    ignoreIfHasNoValue(...columns: string[]): this
    /** 
     * Unset all columns that was set with no value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
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
     * Throw an error if the any other set except the provided column list
     */
    disallowAnyOtherSet(errorMessage: string, ...columns: string[]): this
    disallowAnyOtherSet(error: Error, ...columns: string[]): this
}
```

All these methods have a `When` variant that allows you to specify as the first argument a boolean that, when it is true, the action will be executed. Like: `setWhen(when: boolean, columns: UpdateSets): this`

For example, only a user that can change the company of a customer updates it; for any other user the company given is ignored:

```ts
const canChangeTheCompany = false;

const updatedCount = await connection.update(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 2
    })
    .ignoreIfSetWhen(!canChangeTheCompany, 'companyId')
    .where(tCustomer.id.equals(10))
    .executeUpdate();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    update customer
    set first_name = ?, last_name = ?
    where id = ?
    ```
=== "MySQL"
    ```mysql
    update customer
    set first_name = ?, last_name = ?
    where id = ?
    ```
=== "Oracle"
    ```oracle
    update customer
    set first_name = :0, last_name = :1
    where id = :2
    ```
===+ "PostgreSQL"
    ```postgresql
    update customer
    set first_name = $1, last_name = $2
    where id = $3
    ```
=== "SQLite"
    ```sqlite
    update customer
    set first_name = ?1, last_name = ?2
    where id = ?3
    ```
=== "SQL Server"
    ```sqlserver
    update customer
    set first_name = @0, last_name = @1
    where id = @2
    ```

The parameters are: `[ 'John', 'Smith', 10 ]`

The result type is:
```tsx
const updatedCount: number
```

### When no value is left

If no column is set when you execute the query, for example after a `dynamicSet()` with nothing added, there is nothing to update, so the library doesn't send any query. `executeUpdate` returns `0`, `executeUpdateNoneOrOne` returns `null`, `executeUpdateMany` returns an empty array, and the promise of `executeUpdateOne` rejects with the reason `NO_COLUMN_SETS`. A minimum given to `executeUpdate` or `executeUpdateMany` still applies.

## Update with a shape

The values to update can have other property names than the columns of the table, using a shape: see [Insert and update with a shape](shapes.md).

## Update using other tables or views

Use `from` when the new value, or the condition that chooses the rows, depends on another table or view. It's like the `from` of a select: the condition that relates the tables goes in the `where`. Only the rows of the table in `update` change; the others are only read. Call `from` again to add more tables.

```ts
const addACMECompanyNameToLastName = connection.update(tCustomer)
    .from(tCompany)
    .set({
        lastName: tCustomer.lastName.concat(' - ').concat(tCompany.name)
    })
    .where(tCustomer.companyId.equals(tCompany.id))
    .and(tCompany.name.containsInsensitive('ACME'))
    .executeUpdate()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    update customer, 
           company 
    set customer.last_name = concat(customer.last_name, ?, company.name) 
    where 
            customer.company_id = company.id 
        and lower(company.name) like concat('%', lower(?), '%')
    ```
=== "MySQL"
    ```mysql
    update customer, 
           company 
    set customer.last_name = concat(customer.last_name, ?, company.`name`) 
    where 
            customer.company_id = company.id 
        and lower(company.`name`) like concat('%', lower(?), '%')
    ```
=== "Oracle"
    ```oracle
    update customer 
    set customer.last_name = customer.last_name || :0 || company.name 
    from company 
    where 
            customer.company_id = company.id 
        and lower(company.name) like lower('%' || :1 || '%') escape '\'
    ```
===+ "PostgreSQL"
    ```postgresql
    update customer 
    set last_name = customer.last_name || $1 || company.name 
    from company 
    where 
            customer.company_id = company.id 
        and company.name ilike ('%' || $2 || '%')
    ```
=== "SQLite"
    ```sqlite
    update customer 
    set last_name = customer.last_name || ?1 || company.name 
    from company 
    where 
            customer.company_id = company.id 
        and lower(company.name) like lower('%' || ?2 || '%') escape '\'
    ```
=== "SQL Server"
    ```sqlserver
    update customer 
    set last_name = customer.last_name + @0 + company.name 
    from company 
    where 
            customer.company_id = company.id 
        and lower(company.name) like lower('%' + @1 + '%')
    ```

The parameters are: `[ ' - ', 'ACME' ]`

The result type is a promise with the information of the updated rows:
```tsx
const addACMECompanyNameToLastName: Promise<number>
```

### Using joins

After `from` you can add `join`, `innerJoin`, `leftJoin` or `leftOuterJoin`, each one with its `on`. Their `on` relates the tables in the `from` and the joins; the condition that relates them with the updated table goes in the `where`. As in a select, the table of a left join is the one returned by [`forUseInLeftJoin`](select.md#select-with-left-join).

[MariaDB](../configuration/supported-databases/mariadb.md) and [MySQL](../configuration/supported-databases/mysql.md) also offer the join right after `update`, with no `from`, and its `on` can use the updated table:

```ts
const addACMECompanyNameToLastNameWithJoin = connection.update(tCustomer)
    .innerJoin(tCompany).on(tCustomer.companyId.equals(tCompany.id))
    .set({
        lastName: tCustomer.lastName.concat(' - ').concat(tCompany.name)
    })
    .where(tCompany.name.containsInsensitive('ACME'))
    .executeUpdate()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    update customer 
    inner join company on customer.company_id = company.id 
    set customer.last_name = concat(customer.last_name, ?, company.name) 
    where lower(company.name) like concat('%', lower(?), '%')
    ```
=== "MySQL"
    ```mysql
    update customer 
    inner join company on customer.company_id = company.id 
    set customer.last_name = concat(customer.last_name, ?, company.`name`) 
    where lower(company.`name`) like concat('%', lower(?), '%')
    ```
=== "Oracle"
    ```oracle
    --
    --
    -- Oracle doesn't support a join right after update, use from
    --
    --
    ```
===+ "PostgreSQL"
    ```postgresql
    --
    --
    -- PostgreSQL doesn't support a join right after update, use from
    --
    --
    ```
=== "SQLite"
    ```sqlite
    --
    --
    -- SQLite doesn't support a join right after update, use from
    --
    --
    ```
=== "SQL Server"
    ```sqlserver
    --
    --
    -- SQL Server doesn't support a join right after update, use from
    --
    --
    ```

The parameters are: `[ ' - ', 'ACME' ]`

The result type is a promise with the number of updated rows:
```tsx
const addACMECompanyNameToLastNameWithJoin: Promise<number>
```

### Returning with other tables

`returning` depends more on the database when the update uses other tables. PostgreSQL and Oracle can return columns of the other tables. On SQL Server and SQLite, `returning` only sees the updated table. MariaDB rejects `returning` on an update that uses other tables.

## Update multiple tables in a single query

If you are using [MariaDB](../configuration/supported-databases/mariadb.md) or [MySQL](../configuration/supported-databases/mysql.md) you can update multiple tables in a single query, using a shape: see [Update multiple tables in a single query](shapes.md#update-multiple-tables-in-a-single-query).

## Bulk update

A bulk update changes several rows in a single query, each one with its own values, instead of sending one update per row. To do it, [map the constant values as a view](../configuration/mapping.md#mapping-constant-values-as-view) with `Values`, with one row per row to change, and use it in `from` like any other table.

On [Oracle](../configuration/supported-databases/oracle.md) this isn't possible, not even on Oracle 23ai where `from` is accepted: the query needs a `with` before the `update`, and Oracle rejects it (`ORA-00928`). Use a `MERGE` or a correlated subquery instead.

```ts
class VCustomerForUpdate extends Values<DBConnection, 'customerForUpdate'> {
    id = this.column('int')
    firstName = this.column('string')
    lastName = this.column('string')
}
const customerForUpdate = Values.create(VCustomerForUpdate, 'customerForUpdate', [{
    id: 1,
    firstName: 'First Name',
    lastName: 'Last Name'
}])

const updateCustomer = connection.update(tCustomer)
    .from(customerForUpdate)
    .set({
        firstName: customerForUpdate.firstName,
        lastName: customerForUpdate.lastName
    })
    .where(tCustomer.id.equals(customerForUpdate.id))
    .executeUpdate()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    with 
        customerForUpdate(id, firstName, lastName) as (
            values (?, ?, ?)
        ) 
    update customer, customerForUpdate 
    set 
        customer.first_name = customerForUpdate.firstName, 
        customer.last_name = customerForUpdate.lastName 
    where customer.id = customerForUpdate.id
    ```
=== "MySQL"
    ```mysql
    with 
        customerForUpdate(id, firstName, lastName) as (
            values row(?, ?, ?)
        ) 
    update customer, customerForUpdate 
    set 
        customer.first_name = customerForUpdate.firstName, 
        customer.last_name = customerForUpdate.lastName 
    where customer.id = customerForUpdate.id
    ```
=== "Oracle"
    ```oracle
    --
    --
    --
    --
    --
    -- Oracle doesn't support bulk update
    --
    --
    --
    --
    ```
===+ "PostgreSQL"
    ```postgresql
    with 
        customerForUpdate(id, firstName, lastName) as (
            values ($1::int4, $2::text, $3::text)
        ) 
    update customer 
    set 
        first_name = customerForUpdate.firstName, 
        last_name = customerForUpdate.lastName 
    from customerForUpdate 
    where customer.id = customerForUpdate.id
    ```
=== "SQLite"
    ```sqlite
    with 
        customerForUpdate(id, firstName, lastName) as (
            values (?1, ?2, ?3)
        ) 
    update customer 
    set 
        first_name = customerForUpdate.firstName, 
        last_name = customerForUpdate.lastName 
    from customerForUpdate 
    where customer.id = customerForUpdate.id
    ```
=== "SQL Server"
    ```sqlserver
    with 
        customerForUpdate as (
            select * 
            from (
                values (@0, @1, @2)
            ) as customerForUpdate(id, firstName, lastName)
        ) 
    update customer 
    set 
        first_name = customerForUpdate.firstName, 
        last_name = customerForUpdate.lastName 
    from customerForUpdate 
    where customer.id = customerForUpdate.id
    ```

The parameters are: `[ 1, 'First Name', 'Last Name' ]`

The result type is a promise with the information of the updated rows:
```tsx
const updateCustomer: Promise<number>
```

## Other options

- `where` can be called once: add more conditions with `and` and `or`, or build them step by step with [`dynamicWhere`](../dynamic/going-further/building-conditions.md). A condition can use a [subquery](cte-subqueries.md).
- `customizeQuery` adds raw SQL to the query and names its execution: see [Customizing an update](sql-fragments.md#customizing-an-update).
- `query()` and `params()` return the SQL and the parameters without executing the query.

## Availability in each database

| Database | `returning` | `oldValues()` | `from` | Join right after `update` | `from` with `Values` |
|---|---|---|---|---|---|
| PostgreSQL | Yes | Yes | Yes | Not offered | Yes |
| SQLite | From SQLite 3.35 | Not offered | Yes | Not offered | Yes |
| SQL Server | Yes, written as `output` | Yes | Yes | Not offered | Yes |
| Oracle | Yes, written as `returning into` | Not offered | From Oracle 23ai | Not offered | Rejected by the database |
| MariaDB | From MariaDB 13.0.1 | From MariaDB 13.0.1 | Yes, written as `update a, b` | Yes | From MariaDB 12.3 |
| MySQL | Not offered | Not offered | Yes, written as `update a, b` | Yes | From MySQL 8.0.19 |

An option that is not offered doesn't compile on that connection. On an older version than the one in the table, the database rejects the query.

On PostgreSQL, `oldValues()` is native from PostgreSQL 18. With a lower [`compatibilityVersion`](../configuration/supported-databases/postgresql.md#compatibility-version) it's emulated in a single query, and the table must have a primary key.
