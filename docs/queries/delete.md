---
search:
  boost: 4
---
# Delete

A delete removes from a table the rows that meet a condition. It's the way to do things like "this customer no longer exists", or "remove all the customers of this company".

It always removes whole rows: to empty a column and keep its row, use an [update](update.md).

## Deleting rows

`deleteFrom` receives the table, `where` the rows to remove, and `executeDelete` runs the query.

```ts
const deleteCustomer = connection.deleteFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .executeDelete();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    delete from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    delete from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    delete from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    delete from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    delete from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    delete from customer 
    where id = @0
    ```

The parameters are: `[ 10 ]`

The result type is a promise with the number of deleted rows:
```tsx
const deleteCustomer: Promise<number>
```

!!! danger "Security constraint"

    `ts-sql-query` rejects a delete that ends without a `WHERE` clause. To delete all the rows you must say so: see [Delete without a where](#delete-without-a-where).

## Delete without a where

A delete without a `where` removes all the rows of the table, and it's usually a mistake that is hard to undo. The library stops it in two moments:

- **When you compile:** `deleteFrom(...)` doesn't offer the execute methods until you call `where` or `dynamicWhere`.
- **When you execute:** a condition can end up empty, for example a `dynamicWhere()` with no conditions added, or a `where` with only conditions that are [ignored because they have no value](dynamic-queries.md#optional-conditions-the-ifvalue-methods). The promise of the execute method then rejects with the reason `MISSING_WHERE`, and nothing is sent to the database.

When removing all the rows is what you want, start the query with `deleteAllowingNoWhereFrom` instead of `deleteFrom`:

```ts
const deleteAllCustomers = connection.deleteAllowingNoWhereFrom(tCustomer)
    .executeDelete();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    delete from customer
    ```
=== "MySQL"
    ```mysql
    delete from customer
    ```
=== "Oracle"
    ```oracle
    delete from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    delete from customer
    ```
=== "SQLite"
    ```sqlite
    delete from customer
    ```
=== "SQL Server"
    ```sqlserver
    delete from customer
    ```

The parameters are: `[ ]`

The result type is a promise with the number of deleted rows:
```tsx
const deleteAllCustomers: Promise<number>
```

It only allows the `where` to be missing: if you add one, it's used as usual.

## The number of deleted rows

`executeDelete` returns the number of deleted rows. When that number tells you something went wrong, like a row that had to exist and doesn't, give it a minimum and a maximum:

```ts
const deletedCount = await connection.deleteFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .executeDelete(1, 1);
```

The executed query is:

=== "MariaDB"
    ```mariadb
    delete from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    delete from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    delete from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    delete from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    delete from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    delete from customer 
    where id = @0
    ```

The parameters are: `[ 10 ]`

With fewer rows than the minimum, the error has the reason `MINIMUM_ROWS_NOT_REACHED`; with more rows than the maximum, `MAXIMUM_ROWS_EXCEEDED`.

!!! warning

    The library compares the number after the database has executed the delete, so the rows are already gone. If the error must bring them back, run the delete inside a [transaction](transaction.md).

## Delete returning

`returning` makes the delete give back data of the rows it has removed, in the same query, so you don't need a select before. It receives the same as a `select`, nested objects included, and `returningOneColumn(column)` returns the value of a single column instead of an object.

It isn't available on MySQL: see [Availability in each database](#availability-in-each-database).

```ts
const deletedAcmeCompany = connection.deleteFrom(tCompany)
    .where(tCompany.name.equals('ACME'))
    .returning({
        id: tCompany.id,
        name: tCompany.name
    })
    .executeDeleteOne()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    delete from company 
    where name = ? 
    returning 
        id as id, 
        name as name
    ```
=== "MySQL"
    ```mysql
    --
    --
    -- MySQL doesn't support delete returning values
    --
    --
    ```
=== "Oracle"
    ```oracle
    delete from company 
    where name = :0 
    returning 
        id, 
        name 
    into :1, :2
    ```
===+ "PostgreSQL"
    ```postgresql
    delete from company 
    where name = $1 
    returning 
        id as id, 
        name as name
    ```
=== "SQLite"
    ```sqlite
    delete from company 
    where name = ?1 
    returning 
        id as id, 
        name as name
    ```
=== "SQL Server"
    ```sqlserver
    delete from company 
    output 
        deleted.id as id, 
        deleted.name as name 
    where name = @0
    ```

The parameters are: `[ 'ACME' ]` (On [Oracle](../configuration/supported-databases/oracle.md), output parameters are added at the corresponding position with the structure `{dir:3003}`)

The result type is a promise with the information of the deleted rows:
```tsx
const deletedAcmeCompany: Promise<{
    name: string;
    id: number;
}>
```

**Other options**

You can project optional values in objects as always-required properties that allow null calling `projectingOptionalValuesAsNullable()` immediately after `returning(...)`.

With `returning` or `returningOneColumn` you execute the query with one of these methods, depending on how many rows you expect:

| Method | Returns | With no rows | With several rows |
|---|---|---|---|
| `executeDeleteNoneOrOne()` | The row or `null` | `null` | Error `MORE_THAN_ONE_ROW` |
| `executeDeleteOne()` | The row | Error `NO_RESULT` | Error `MORE_THAN_ONE_ROW` |
| `executeDeleteMany(min?, max?)` | An array of rows | An empty array | All the rows |

`min` and `max` in `executeDeleteMany` work as in [`executeDelete`](#the-number-of-deleted-rows). All these errors arrive when the database has already executed the delete.

## Delete using other tables or views

Use `using` when the condition that chooses the rows depends on another table or view. It's like the `from` of a select: the condition that relates the tables goes in the `where`. Only the rows of the table in `deleteFrom` are removed; the others are only read. Call `using` again to add more tables.

```ts
const deleteACMECustomers = connection.deleteFrom(tCustomer)
    .using(tCompany)
    .where(tCustomer.companyId.equals(tCompany.id))
    .and(tCompany.name.containsInsensitive('ACME'))
    .executeDelete()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    delete from customer 
    using customer, 
          company 
    where 
            customer.company_id = company.id 
        and lower(company.name) like concat('%', lower(?), '%')
    ```
=== "MySQL"
    ```mysql
    delete from customer 
    using customer, 
          company 
    where 
            customer.company_id = company.id 
        and lower(company.`name`) like concat('%', lower(?), '%')
    ```
=== "Oracle"
    ```oracle
    delete from customer 
    using company 
    where 
            customer.company_id = company.id 
        and lower(company.name) like lower('%' || :0 || '%') escape '\'
    ```
===+ "PostgreSQL"
    ```postgresql
    delete from customer 
    using company 
    where 
            customer.company_id = company.id 
        and company.name ilike ('%' || $1 || '%')
    ```
=== "SQLite"
    ```sqlite
    --
    --
    -- SQLite doesn't support delete using other tables or views
    --
    --
    ```
=== "SQL Server"
    ```sqlserver
    delete from customer 
    from company 
    where 
            customer.company_id = company.id 
        and lower(company.name) like lower('%' + @0 + '%')
    ```

The parameters are: `[ 'ACME' ]`

The result type is a promise with the information of the deleted rows:
```tsx
const deleteACMECustomers: Promise<number>
```

### Using a subquery

`using` isn't offered on [SQLite](../configuration/supported-databases/sqlite.md). A subquery in the `where` chooses the rows in the same way, and it works on all the databases:

```ts
const deleteACMECustomersWithSubquery = connection.deleteFrom(tCustomer)
    .where(tCustomer.companyId.in(
        connection.selectFrom(tCompany)
            .where(tCompany.name.containsInsensitive('ACME'))
            .selectOneColumn(tCompany.id)
    ))
    .executeDelete()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    delete from customer 
    where company_id in (
        select id as result 
        from company 
        where lower(name) like concat('%', lower(?), '%')
    )
    ```
=== "MySQL"
    ```mysql
    delete from customer 
    where company_id in (
        select id as result 
        from company 
        where lower(`name`) like concat('%', lower(?), '%')
    )
    ```
=== "Oracle"
    ```oracle
    delete from customer 
    where company_id in (
        select id as "result" 
        from company 
        where lower(name) like lower('%' || :0 || '%') escape '\'
    )
    ```
===+ "PostgreSQL"
    ```postgresql
    delete from customer 
    where company_id in (
        select id as result 
        from company 
        where name ilike ('%' || $1 || '%')
    )
    ```
=== "SQLite"
    ```sqlite
    delete from customer 
    where company_id in (
        select id as result 
        from company 
        where lower(name) like lower('%' || ?1 || '%') escape '\'
    )
    ```
=== "SQL Server"
    ```sqlserver
    delete from customer 
    where company_id in (
        select id as [result] 
        from company 
        where lower(name) like lower('%' + @0 + '%')
    )
    ```

The parameters are: `[ 'ACME' ]`

The result type is a promise with the number of deleted rows:
```tsx
const deleteACMECustomersWithSubquery: Promise<number>
```

### Using joins

After `using` you can add `join`, `innerJoin`, `leftJoin` or `leftOuterJoin`, each one with its `on`. Their `on` relates the tables in the `using` and the joins; the condition that relates them with the table to delete from goes in the `where`. As in a select, the table of a left join is the one returned by [`forUseInLeftJoin`](select.md#select-with-left-join).

[MariaDB](../configuration/supported-databases/mariadb.md) and [MySQL](../configuration/supported-databases/mysql.md) also offer the join right after `deleteFrom`, with no `using`, and its `on` can use the table to delete from:

```ts
const deleteACMECustomersWithJoin = connection.deleteFrom(tCustomer)
    .innerJoin(tCompany).on(tCustomer.companyId.equals(tCompany.id))
    .where(tCompany.name.containsInsensitive('ACME'))
    .executeDelete()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    delete from customer 
    using customer 
    inner join company on customer.company_id = company.id 
    where lower(company.name) like concat('%', lower(?), '%')
    ```
=== "MySQL"
    ```mysql
    delete from customer 
    using customer 
    inner join company on customer.company_id = company.id 
    where lower(company.`name`) like concat('%', lower(?), '%')
    ```
=== "Oracle"
    ```oracle
    --
    --
    -- Oracle doesn't support a join right after delete, use using
    --
    --
    ```
===+ "PostgreSQL"
    ```postgresql
    --
    --
    -- PostgreSQL doesn't support a join right after delete, use using
    --
    --
    ```
=== "SQLite"
    ```sqlite
    --
    --
    -- SQLite doesn't support a join right after delete
    --
    --
    ```
=== "SQL Server"
    ```sqlserver
    --
    --
    -- SQL Server doesn't support a join right after delete, use using
    --
    --
    ```

The parameters are: `[ 'ACME' ]`

The result type is a promise with the number of deleted rows:
```tsx
const deleteACMECustomersWithJoin: Promise<number>
```

### Returning with other tables

`returning` depends more on the database when the delete uses other tables. PostgreSQL, SQL Server and Oracle can return columns of the other tables. MariaDB rejects `returning` on a delete that uses other tables.

## Bulk delete

A bulk delete removes several rows in a single query, when each one is identified by its own values and a simple condition isn't enough, instead of sending one delete per row. To do it, [map the constant values as a view](../configuration/mapping.md#mapping-constant-values-as-view) with `Values`, with one row per row to remove, and use it in `using` like any other table.

On [Oracle](../configuration/supported-databases/oracle.md) this isn't possible, not even on Oracle 23ai where `using` is accepted: the query needs a `with` before the `delete`, and Oracle rejects it (`ORA-00928`). Use a `MERGE` or a correlated subquery instead. [SQLite](../configuration/supported-databases/sqlite.md) has no `using`.

```ts
class VCustomerForDelete extends Values<DBConnection, 'customerForDelete'> {
    firstName = this.column('string')
    lastName = this.column('string')
}
const customerForDelete = Values.create(VCustomerForDelete, 'customerForDelete', [{
    firstName: 'First Name',
    lastName: 'Last Name'
}])

const deleteCustomer = connection.deleteFrom(tCustomer)
    .using(customerForDelete)
    .where(tCustomer.firstName.equals(customerForDelete.firstName))
    .and(tCustomer.lastName.equals(customerForDelete.lastName))
    .executeDelete()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    with 
        customerForDelete(firstName, lastName) as (
            values (?, ?)
        ) 
    delete from customer 
    using customer, customerForDelete 
    where 
            customer.first_name = customerForDelete.firstName 
        and customer.last_name = customerForDelete.lastName
    ```
=== "MySQL"
    ```mysql
    with 
        customerForDelete(firstName, lastName) as (
            values row(?, ?)
        ) 
    delete from customer 
    using customer, customerForDelete 
    where 
            customer.first_name = customerForDelete.firstName 
        and customer.last_name = customerForDelete.lastName
    ```
=== "Oracle"
    ```oracle
    --
    --
    --
    --
    -- Oracle doesn't support bulk delete
    --
    --
    --
    --
    ```
===+ "PostgreSQL"
    ```postgresql
    with 
        customerForDelete(firstName, lastName) as (
            values ($1::text, $2::text)
        ) 
    delete from customer 
    using customerForDelete 
    where 
            customer.first_name = customerForDelete.firstName 
        and customer.last_name = customerForDelete.lastName
    ```
=== "SQLite"
    ```sqlite
    --
    --
    --
    --
    -- SQLite doesn't support bulk delete
    --
    --
    --
    --
    ```
=== "SQL Server"
    ```sqlserver
    with 
        customerForDelete as (
            select * 
            from (
                values (@0, @1)
            ) as customerForDelete(firstName, lastName)
        ) 
    delete from customer 
    from customerForDelete 
    where 
            customer.first_name = customerForDelete.firstName 
        and customer.last_name = customerForDelete.lastName
    ```

The parameters are: `[ 'First Name', 'Last Name' ]`

The result type is a promise with the information of the deleted rows:
```tsx
const deleteCustomer: Promise<number>
```

## Other options

- `where` can be called once: add more conditions with `and` and `or`, or build them step by step with [`dynamicWhere`](../dynamic/going-further/building-conditions.md).
- `customizeQuery` adds raw SQL to the query and names its execution: see [Customizing a delete](sql-fragments.md#customizing-a-delete).
- `query()` and `params()` return the SQL and the parameters without executing the query.

## Availability in each database

| Database | `returning` | `using` | Join right after `deleteFrom` | `using` with `Values` |
|---|---|---|---|---|
| PostgreSQL | Yes | Yes | Not offered | Yes |
| SQLite | From SQLite 3.35 | Not offered | Not offered | Not offered |
| SQL Server | Yes, written as `output` | Yes, written as `from` | Not offered | Yes |
| Oracle | Yes, written as `returning into` | From Oracle 23ai | Not offered | Rejected by the database |
| MariaDB | From MariaDB 10.0.5 | Yes | Yes | From MariaDB 12.3 |
| MySQL | Not offered | Yes | Yes | From MySQL 8.0.19 |

An option that is not offered doesn't compile on that connection. On an older version than the one in the table, the database rejects the query.
