---
search:
  boost: 4
---
# Insert and update with a shape

A shape maps the property names of the values to write to the columns of the table, for when they don't have the same name, and it limits what is written: only the values included in the shape are inserted or updated, and any other property in the object is ignored. It's what makes possible to write the values of an object that comes from somewhere else, as it is, and to update more than one table in the same query.

For the usual case, where the properties have the name of the columns, you don't need it: see [Insert](insert.md) and [Update](update.md).

## When to use a shape

A shape is worth it when:

- The values come from somewhere else with other names, like a form or another model, and you don't want to copy them to a new object.
- The object has more properties than the ones you want to write. Without a shape, every property named as a column is written, also one you didn't expect.
- You update [several tables in a single query](#update-multiple-tables-in-a-single-query).

These are the columns written with the values `{ newFirstName: 'John', newLastName: 'Smith', companyId: 5, token: 'abc' }`:

| | Written | Ignored |
|---|---|---|
| `set(values)` | `company_id` | `newFirstName`, `newLastName` and `token`, because they aren't columns |
| `shapedAs({ newFirstName: 'firstName', newLastName: 'lastName' }).set(values)` | `first_name`, `last_name` | `companyId` and `token`, because they aren't in the shape |

An object with extra properties must be in a variable. Written directly in the call, TypeScript rejects the extra properties, as it does with any object literal.

## How to write a shape

Each property of a shape has the name of the property in the values, and the column where it's written:

- The name of the column, like `'firstName'`.
- The path of a column in a group, like `'ubication.latitude'`: see [Columns in a group](#columns-in-a-group).
- In an update, also the column itself, like `tCustomer.firstName`.

After `shapedAs`, `set` and the methods that [manipulate the values](update.md#manipulating-values-to-update) use the names of the shape, like `ignoreIfSet('newFirstName')`. A value can also be an expression, as in a `set` without a shape.

`extendShape` adds more properties to the shape. It's useful to write the values that come from somewhere else with `set`, limited by the shape, and then add a value that your code decides, like the company of the current user. The following examples do it. A `set` uses the shape as it is when `set` is called, so extend the shape first. A property of the shape can't be changed: trying it throws an error with the reason `INVALID_SHAPE_OVERRIDE`.

## Insert with a shape

The property in the values doesn't need to have the name of the column, and only the values included in the shape are inserted. The shape can leave out required columns: in that case, you get a compilation error (you can't call the execute methods) until you extend the shape with the missing properties and set their values.

```ts
const customerToInsert = {
    customerFirstName: 'John',
    customerLastName: 'Smith'
}
const currentCompanyId = 23

const insertCustomer = connection.insertInto(tCustomer)
    .shapedAs({
        customerFirstName: 'firstName',
        customerLastName: 'lastName'
    }).set(customerToInsert)
    .extendShape({
        customerCompanyId: 'companyId'
    }).set({
        customerCompanyId: currentCompanyId
    }).returningLastInsertedId()
    .executeInsert()
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

The parameters are: `[ "John", "Smith", 23 ]` (On [Oracle](../configuration/supported-databases/oracle.md), output parameters are added at the corresponding position with the structure `{dir:3003}`) 

The result type is a promise with the id of the last inserted row:
```tsx
const insertCustomer: Promise<number>
```

## Insert multiple rows with a shape

It works in the same way with the rows of `values`, and `setForAll` gives the same value to all of them. The shape can also leave out required columns here: you can't call `executeInsert()` until you extend the shape with the missing properties and set their values.

```ts
const customersToInsert = [
    {
        customerFirstName: 'John',
        customerLastName: 'Smith'
    },
    {
        customerFirstName: 'Other',
        customerLastName: 'Person'
    }
]
const currentCompanyId = 23

const insertMultipleCustomers = await connection.insertInto(tCustomer)
    .shapedAs({
        customerFirstName: 'firstName',
        customerLastName: 'lastName'
    })
    .values(customersToInsert)
    .extendShape({
        customerCompanyId: 'companyId'
    }).setForAll({
        customerCompanyId: currentCompanyId
    }).returningLastInsertedId()
    .executeInsert()
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

    insert into customer (first_name, last_name, company_id) values (:0, :1, :2) 
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

The parameters are: `[ "John", "Smith", 23, "Other", "Person", 23 ]` (On [Oracle](../configuration/supported-databases/oracle.md), output parameters are added at the corresponding position with the structure `{dir:3003}`) 

The result type is a promise with the id of the last inserted rows:
```tsx
const insertMultipleCustomers: Promise<number[]>
```

## Update with a shape

The property in the values doesn't need to have the name of the column, and only the values included in the shape are updated. An update has no required columns, so the shape can have any of them.

```ts
const customerId = 10
const customerData = {
    newFirstName: 'John',
    newLastName: 'Smith',
    // You can include customerId here if you want, because it is not part of the shape it will be ignored
}
const currentCompanyId = 23

const updateCustomer = connection.update(tCustomer)
    .shapedAs({
        newFirstName: 'firstName',
        newLastName: 'lastName'
        // Any property in the values not included here will be ignored
    }) // Only these properties are allowed
    .set(customerData)
    .extendShape({
        newCompanyId: 'companyId'
    }) // Extend the shape to allow use in next sets 
    .set({
        newCompanyId: currentCompanyId
    })
    // If you included the customerId in the data, then you should be able to do:
    // .where(tCustomer.id.equals(customerData.customerId))
    .where(tCustomer.id.equals(customerId))
    .executeUpdate()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    update customer 
    set 
        first_name = ?, 
        last_name = ?, 
        company_id = ? 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    update customer 
    set 
        first_name = ?, 
        last_name = ?, 
        company_id = ? 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    update customer 
    set 
        first_name = :0, 
        last_name = :1, 
        company_id = :2 
    where id = :3
    ```
===+ "PostgreSQL"
    ```postgresql
    update customer 
    set 
        first_name = $1, 
        last_name = $2, 
        company_id = $3 
    where id = $4
    ```
=== "SQLite"
    ```sqlite
    update customer 
    set 
        first_name = ?1, 
        last_name = ?2, 
        company_id = ?3 
    where id = ?4
    ```
=== "SQL Server"
    ```sqlserver
    update customer 
    set 
        first_name = @0, 
        last_name = @1, 
        company_id = @2 
    where id = @3
    ```

The parameters are: `[ "John", "Smith", 23, 10 ]`

The result type is a promise with the information of the updated rows:
```tsx
const updateCustomer: Promise<number>
```

## Columns in a group

When the table has [groups of columns](../configuration/mapping.md#grouping-columns), a shape names a column in a group by its path. It can also have its own groups, which don't need to follow the ones of the table, and the values then follow the groups of the shape:

```ts
const query = connection.update(tGroupedCompany)
    .shapedAs({ title: 'name', position: { lat: 'ubication.latitude', lng: 'ubication.longitude' } })
    .set({ position: { lat: '40.4' } })
    .where(tGroupedCompany.id.equals(10));
```

## A shape from the columns of the table

[`extractWritableShapeFrom`](../advanced/columns-from-object.md#extract-writable-shape) gives a shape with all the columns that can be written, each one with its own name. It's useful when the properties already have the names of the columns and you only want to limit what is written: the second argument lists the columns to leave out. Groups of columns stay as groups, with the paths of their columns.

```ts
import { extractWritableShapeFrom } from "ts-sql-query" // or "ts-sql-query/extras/utils";

const customerData = {
    firstName: 'John',
    lastName: 'Smith',
    token: 'abc'
}

const updateCustomerData = connection.update(tCustomer)
    .shapedAs(extractWritableShapeFrom(tCustomer, ['id', 'companyId']))
    .set(customerData)
    .where(tCustomer.id.equals(10))
    .executeUpdate()
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

The query writes `first_name` and `last_name`, and the `where` chooses the row. `token` is ignored because it isn't in the shape.

## The type of the values

The [utility types](../advanced/utility-types.md) give the type of the values that follow a shape, for example to declare the parameter of a function:

| Type | What it gives |
|---|---|
| [`InsertableValuesShapedAs`](../advanced/utility-types.md#insertable-values) | The values of an insert |
| [`InsertableRowShapedAs`](../advanced/utility-types.md#insertable-row) | The values of an insert, also accepting expressions |
| [`UpdatableValuesShapedAs`](../advanced/utility-types.md#updatable-values) | The values of an update |
| [`UpdatableRowShapedAs`](../advanced/utility-types.md#updatable-row) | The values of an update, also accepting expressions |
| [`UpdatableOnInsertConflictValuesShapedAs`](../advanced/utility-types.md#updatable-values-in-case-of-conflict-on-insert) | The values to update when an insert has a conflict |
| [`UpdatableOnInsertConflictRowShapedAs`](../advanced/utility-types.md#updatable-row-in-case-of-conflict-on-insert) | The values to update when an insert has a conflict, also accepting expressions |
| [`WritableShapeFor`](../advanced/utility-types.md#writable-shape) | The shape that `extractWritableShapeFrom` returns |

The shape must be declared `as const`, so the type knows the columns:

```ts
import { UpdatableValuesShapedAs } from 'ts-sql-query' // or 'ts-sql-query/extras/types';

const customerShape = {
    newFirstName: 'firstName',
    newLastName: 'lastName'
} as const;

type CustomerData = UpdatableValuesShapedAs<typeof tCustomer, typeof customerShape>;

const customerData: CustomerData = { newFirstName: 'John' };

const updateCustomerName = await connection.update(tCustomer)
    .shapedAs(customerShape)
    .set(customerData)
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
## Update multiple tables in a single query

On [MariaDB](../configuration/supported-databases/mariadb.md) and [MySQL](../configuration/supported-databases/mysql.md) a single query can change the columns of more than one table, like the name of a customer and the name of their company. Join the tables right after `update`, and use a shape: it's the shape that says where each value goes. A column of the other tables goes in the shape as the column itself, like `tCompany.name`, because a name refers only to the table in `update`.

<!-- doc-code-snippet-template: mariadb -->
```ts
const shapedUpdateCustomerNameAndCompanyName = {
    id: 12,
    customerFirstName: 'John',
    customerLastName: 'Smith',
    companyName: 'ACME Inc.'
}

const shapedUpdateCustomerNameAndCompanyNameResult = connection.update(tCustomer)
    .innerJoin(tCompany).on(tCustomer.companyId.equals(tCompany.id))
    .shapedAs({
        customerFirstName: tCustomer.firstName,
        customerLastName: tCustomer.lastName,
        companyName: tCompany.name
    })
    .set(shapedUpdateCustomerNameAndCompanyName)
    .where(tCustomer.id.equals(shapedUpdateCustomerNameAndCompanyName.id))
    .executeUpdate()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    update customer 
    inner join company on customer.company_id = company.id 
    set 
        customer.first_name = ?, 
        customer.last_name = ?, 
        company.name = ? 
    where customer.id = ?
    ```
=== "MySQL"
    ```mysql
    update customer 
    inner join company on customer.company_id = company.id 
    set 
        customer.first_name = ?, 
        customer.last_name = ?, 
        company.`name` = ? 
    where customer.id = ?
    ```
=== "Oracle"
    ```oracle
    --
    --
    --
    -- Oracle doesn't support update multiple tables in a single query
    --
    --
    --
    ```
===+ "PostgreSQL"
    ```postgresql
    --
    --
    --
    -- PostgreSQL doesn't support update multiple tables in a single query
    --
    --
    --
    ```
=== "SQLite"
    ```sqlite
    --
    --
    --
    -- SQLite doesn't support update multiple tables in a single query
    --
    --
    --
    ```
=== "SQL Server"
    ```sqlserver
    --
    --
    --
    -- SQL Server doesn't support update multiple tables in a single query
    --
    --
    --
    ```

The parameters are: `[ "John", "Smith", "ACME Inc.", 12 ]`

The result type is a promise with the information of the updated rows:
```tsx
const shapedUpdateCustomerNameAndCompanyNameResult: Promise<number>
```

The number returned counts the rows changed in all the tables: in this example, 2 if both tables change.
