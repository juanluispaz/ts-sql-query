---
search:
  boost: 4
---
# Update

This page explains how to construct SQL `UPDATE` statements using `ts-sql-query`. It covers conditional updates, shape-based value mappings, updating with data from other tables, returning updated or previous values, and manipulating sets of columns dynamically during the update process.

## General update

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
```sql
update customer 
set first_name = $1, last_name = $2 
where id = $3
```

The parameters are: `[ 'John', 'Smith', 10 ]`

The result type is a promise with the number of updated rows:
```tsx
const updateCustomer: Promise<number>
```

!!! danger "Security constraint"

    `ts-sql-query` will reject the execution of the update sentence if, for some reason, ended without a `WHERE` clause. If you want to allow an update without where, you must call `connection.updateAllowingNoWhere(...)` instead of `connection.update(...)` when you start writing the sentence.

## Update returning

If you are using [PostgreSQL](../configuration/supported-databases/postgresql.md), modern [SQLite](../configuration/supported-databases/sqlite.md), [SQL Server](../configuration/supported-databases/sqlserver.md) or [Oracle](../configuration/supported-databases/oracle.md), you can return updated values of the updated record in the same query using the `returning` or `returningOneColumn` methods.

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
```sql
update customer 
set first_name = $1 
where id = $2 
returning first_name as result
```

The parameters are: `[ 'Ron', 1 ]`

The result type is a promise with the information of the updated rows:
```tsx
const updatedSmithFirstName: Promise<string>
```

**Other options**

You can project optional values in objects as always-required properties that allow null calling `projectingOptionalValuesAsNullable()` immediately after `returning(...)`.

You can execute the query using:

- `executeUpdateNoneOrOne(): Promise<RESULT | null>`: Execute the update query that returns one or no result from the database. In case of more than one result found, it throws and error with message 'Too many rows, expected only zero or one row'.
- `executeUpdateOne(): Promise<RESULT>`: Execute the update query that returns one result from the database. If no result is returned by the database an exception will be thrown.
- `executeUpdateMany(min?: number, max?: number): Promise<RESULT[]>`: Execute the update query that returns zero or many results from the database.

Aditionally, if you want to return the value of a single column, you can use `returningOneColumn(column)` instead of `returning({...})`.

## Update returning old values

If you are using [SQL Server](../configuration/supported-databases/sqlserver.md) or [PostgreSQL](../configuration/supported-databases/postgresql.md) (emulated in a single query, the table must have a primary key), you can return previous values of the updated record in the same query; to do this, you can create a reference to the old values of the table calling `myTable.oldValues()` and then use it in the returning clause.

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
```sql
update customer as _new_ 
set last_name = $1 
from (
    select _old_.* 
    from customer as _old_ 
    where _old_.id = $2 
    for no key update of _old_
) as _old_ 
where _new_.id = _old_.id 
returning _old_.last_name as oldLastName, _new_.last_name as newLastName
```

The parameters are: `[ 'Thomson', 2 ]`

The result type is a promise with the information of the updated rows:
```tsx
const updatedLastNames: Promise<{
    oldLastName: string;
    newLastName: string;
}>
```

## Update using other tables or views

Sometimes you want to include in the update query other tables or views to process the update instruction, you can add the `from` clause that is like a `from` clasue in a select. This is supported by [PostgreSQL](../configuration/supported-databases/postgresql.md), [SQLite](../configuration/supported-databases/sqlite.md), [SQL Server](../configuration/supported-databases/sqlserver.md), [MariaDB](../configuration/supported-databases/mariadb.md) or [MySQL](../configuration/supported-databases/mysql.md).

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
```sql
update customer 
set last_name = customer.last_name || $1 || company.name 
from company 
where customer.company_id = company.id 
    and company.name ilike ('%' || $2 || '%')
```

The parameters are: `[ ' - ', 'ACME' ]`

The result type is a promise with the information of the updated rows:
```tsx
const addACMECompanyNameToLastName: Promise<number>
```

## Bulk update

Sometimes you want to do several updates in a single query, where each one have their own data; for this cases you can [map the constant values as view](../configuration/mapping.md#mapping-constant-values-as-view) and perform the update. This is only supported by [PostgreSQL](../configuration/supported-databases/postgresql.md), [SQL Server](../configuration/supported-databases/sqlserver.md) and [SQLite](../configuration/supported-databases/sqlite.md).

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
```sql
with 
    customerForUpdate(id, firstName, lastName) as (
        values ($1::int4, $2, $3)
    ) 
update customer
set first_name = customerForUpdate.firstName, last_name = customerForUpdate.lastName
from customerForUpdate 
where customer.id = customerForUpdate.id
```

The parameters are: `[ 1, 'First Name', 'Last Name' ]`

The result type is a promise with the information of the updated rows:
```tsx
const updateCustomer: Promise<number>
```

## Update with value's shape

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
```sql
update customer 
set first_name = $1, last_name = $2, company_id = $3 
where id = $4
```

The parameters are: `[ "John", "Smith", 23, 10 ]`

The result type is a promise with the information of the updated rows:
```tsx
const updateCustomer: Promise<number>
```

## Update multiple tables in a single query

If you are using [MariaDB](../configuration/supported-databases/mariadb.md) or [MySQL](../configuration/supported-databases/mysql.md) you can update multiples tables in a single query. To do this you will need to join the tables to update, and then specify the value's shape.

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
    .where(tCustomer.id.equals(shapedUpdateCustomerName.id))
    .executeUpdate()
```

The executed query is:
```sql
update customer 
inner join company on customer.company_id = company.id 
set customer.first_name = ?, customer.last_name = ?, company.name = ? 
where customer.id = ?
```

The parameters are: `[ "John", "Smith", "ACME Inc.", 12 ]`

The result type is a promise with the information of the updated rows:
```tsx
const shapedUpdateCustomerNameAndCompanyNameResult: Promise<number>
```

## Manipulating values to update

`ts-sql-query` offers many commodity methods to manipulate the data to update, allowing adding missing values, deleting undesired values, or throwing an error if a value is present.

When you write your update query, you set the initial value calling:

```ts
interface UpdateExpression {
    set(columns: UpdateSets): this
    dynamicSet(): this
    dynamicSet(columns: UpdateSets): this
}
```

The `set` and method will require you to provide the values to update. The `dynamicSet` will allow you start with no values at all.

When you set the initial value, you can start manipulating them using the following methods:

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
```

All these methods have a `When` variant that allows you to specify as the first argument a boolean that, when it is true, the action will be executed. Like: `setWhen(when: boolean, columns: UpdateSets): this`
