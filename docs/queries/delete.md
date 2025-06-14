---
search:
  boost: 4
---
# Delete

This page explains how to construct SQL `DELETE` statements using `ts-sql-query`. It covers conditional deletions, returning deleted values using `returning`, deleting with additional tables via `using`, and bulk deletions using mapped constant values. It also highlights safety mechanisms to avoid unintended full-table deletions.

## General delete

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
    where id = ?
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

    `ts-sql-query` will reject the execution of a delete statement if, for some reason, it ends without a `WHERE` clause. If you want to allow a delete without where, you must call `connection.deleteAllowingNoWhereFrom(...)` instead of `connection.deleteFrom(...)` when you start writing the sentence.

## Delete returning

If you are using [PostgreSQL](../configuration/supported-databases/postgresql.md), modern [SQLite](../configuration/supported-databases/sqlite.md), [SQL Server](../configuration/supported-databases/sqlserver.md), modern [MariaDB](../configuration/supported-databases/mariadb.md) or [Oracle](../configuration/supported-databases/oracle.md), you can return values of the deleted record in the same query using the `returning` or `returningOneColumn` methods.

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
    where name = ? 
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

You can execute the query using:

- `executeDeleteNoneOrOne(): Promise<RESULT | null>`: Execute the delete query that returns one or no result from the database. In case of more than one result found, it throws an error with message 'Too many rows, expected only zero or one row'.
- `executeDeleteOne(): Promise<RESULT>`: Execute the delete query that returns one result from the database. If no result is returned by the database an exception will be thrown.
- `executeDeleteMany(min?: number, max?: number): Promise<RESULT[]>`: Execute the delete query that returns zero or many results from the database.

Aditionally, if you want to return the value of a single column, you can use `returningOneColumn(column)` instead of `returning({...})`.

## Delete using other tables or views

Sometimes you want to include in the delete query other tables or views to process the delete instruction, you can add the `using` clause that is like a `from` clause in a select statement. This is supported by [PostgreSQL](../configuration/supported-databases/postgresql.md), [SQL Server](../configuration/supported-databases/sqlserver.md), [MariaDB](../configuration/supported-databases/mariadb.md) or [MySQL](../configuration/supported-databases/mysql.md).

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
    --
    --
    -- Oracle doesn't support delete using other tables or views
    --
    --
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

## Bulk delete

Sometimes you need to delete multiple rows in a single query, where each condition depends on different data. For these cases, you can [map the constant values as a view](../configuration/mapping.md#mapping-constant-values-as-view) and perform the deletion. This is only supported by [PostgreSQL](../configuration/supported-databases/postgresql.md) and [SQL Server](../configuration/supported-databases/sqlserver.md).

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
    --
    --
    --
    --
    -- MariaDB doesn't support bulk update
    --
    --
    --
    --
    ```
=== "MySQL"
    ```mysql
    --
    --
    --
    --
    -- MySQL doesn't support bulk update
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
    -- Oracle doesn't support bulk update
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
    -- SQLite doesn't support bulk update
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
