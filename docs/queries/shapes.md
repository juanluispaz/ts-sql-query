---
search:
  boost: 4
---
# Insert and update with a shape

A shape maps the property names of the values to write to the columns of the table, for when they don't have the same name, and it limits what is written: only the values included in the shape are inserted or updated, and any other property in the object is ignored. It's what makes possible to write the values of an object that comes from somewhere else, as it is, and to update more than one table in the same query.

For the usual case, where the properties have the name of the columns, you don't need it: see [Insert](insert.md) and [Update](update.md). The types of the rows that follow a shape are in the [utility types](../advanced/utility-types.md), and [`extractWritableShapeFrom`](../advanced/columns-from-object.md#extract-writable-shape) gives the shape of the columns of a table.

## Insert with a shape

You can specify the object's shape that contains the values to insert. This shape allows you to map each property in the values to insert with the columns in the table; in that way, the property in the value doesn't need to have the same name. The only values to be inserted are the ones included in the shape. Additionally, you can extend the shape later to allow set additional properties in future set over this query. Be aware the shape can be a subset of the required columns; in that case, you will get a compilation error (you will not be able to call the execute methods) if you don't extend the shape by adding the missing keys and setting the proper values.

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

You can specify the object's shape that contains the values to insert. This shape allows you to map each property in the values to insert with the columns in the table; in that way, the property in the value doesn't need to have the same name. The only values to be inserted are the ones included in the shape. Additionally, you can extend the shape later to allow set additional properties in future set over this query. Be aware the shape can be a subset of the required columns. If any required column is missing, you will get a compilation error and the query execution methods (such as `executeInsert()`) will not be available if you don't extend the shape by adding the missing keys and setting the proper values.

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

You can specify the object's shape that contains the values to update. This shape allows you to map each property in the values to update with the columns in the table; in that way, the property in the value doesn't need to have the same name. The only values to be updated are the ones included in the shape. Additionally, you can extend the shape later to allow set additional properties in future set over this query.

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
    }) // Exend the shape to allow use in next sets 
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

## Update multiple tables in a single query

If you are using [MariaDB](../configuration/supported-databases/mariadb.md) or [MySQL](../configuration/supported-databases/mysql.md) you can update multiples tables in a single query. To do this you will need to join the tables to update, and then specify the value's shape.

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

## Columns in a group

When the table has [groups of columns](../configuration/mapping.md#grouping-columns), a shape names a column in a group by its path, and it can have its own groups, which don't need to follow the ones of the table:

```ts
const query = connection.update(tCompany)
    .shapedAs({ title: 'name', position: { lat: 'ubication.latitude', lng: 'ubication.longitude' } })
    .set({ position: { lat: '40.4' } })
    .where(tCompany.id.equals(10));
```
