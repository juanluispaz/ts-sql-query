---
search:
  boost: 4
---
# Insert

This page explains how to construct SQL `INSERT` statements using `ts-sql-query`. It covers single and multiple inserts, inserts from `SELECT`, column shape mapping, value manipulation methods, and how to handle conflicts using `onConflictDoNothing` or `onConflictDoUpdateSet` for upsert behavior.

## Insert one row

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
```sql
insert into customer (first_name, last_name, company_id, birthday) 
values ($1, $2, $3, $4) 
returning id
```

The parameters are: `[ 'John', 'Smith', 1, 2019-08-16T15:02:32.849Z ]`

The result type is a promise with the id of the last inserted row:
```tsx
const insertCustomer: Promise<number>
```

## Insert multiple values

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
```sql
insert into customer (first_name, last_name, company_id)
values 
    ($1, $2, $3),
    ($4, $5, $6) 
returning id
```

The parameters are: `[ 'John', 'Smith', 1, 'Other', 'Person', 1 ]`

The result type is a promise with the id of the last inserted rows:
```tsx
const insertMultipleCustomers: Promise<number[]>
```

!!! note

    Return the last inserted id of an insert with multiple rows is only supported by **[PostgreSQL](../configuration/supported-databases/postgresql.md)**, **[SQL Server](../configuration/supported-databases/sqlserver.md)** and **[Oracle](../configuration/supported-databases/oracle.md)**. If you try to use it with other database you will get a compilation error.

## Insert from select

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
```sql
insert into customer (first_name, last_name, company_id) 
select first_name as firstName, last_name as lastName, company_id as companyId 
from customer 
where company_id = $1 
```

The parameters are: `[ 1 ]`

The result type is a promise with the number of inserted rows:
```tsx
const insertCustomer: Promise<number>
```

## Insert returning

If you are using [PostgreSQL](../configuration/supported-databases/postgresql.md), modern [SQLite](../configuration/supported-databases/sqlite.md), [SQL Server](../configuration/supported-databases/sqlserver.md) or [Oracle](../configuration/supported-databases/oracle.md) (except for an insert from select), you can return values of the inserted record in the same query using the `returning` or `returningOneColumn` methods.

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
```sql
insert into customer (first_name, last_name, company_id) 
values ($1, $2, $3) 
returning id as id, first_name as firstName, last_name as lastName
```

The parameters are: `[ 'John', 'Smith', 1 ]`

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

- `executeInsertNoneOrOne(): Promise<RESULT | null>`: Execute the insert query that returns one or no result from the database. In case of more than one result found, it throws and error with message 'Too many rows, expected only zero or one row'.
- `executeInsertOne(): Promise<RESULT>`: Execute the insert query that returns one result from the database. If no result is returned by the database an exception will be thrown.
- `executeInsertMany(min?: number, max?: number): Promise<RESULT[]>`: Execute the insert query that returns zero or many results from the database.

Aditionally, if you want to return the value of a single column, you can use `returningOneColumn(column)` instead of `returning({...})`.

## Insert with value's shape

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
```sql
insert into customer (first_name, last_name, company_id) 
values ($1, $2, $3) 
returning id
```

The parameters are: `[ "John", "Smith", 23 ]`

The result type is a promise with the id of the last inserted row:
```tsx
const insertCustomer: Promise<number>
```

## Insert multiple with value' shape

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
currentCompanyId = 23

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
```sql
insert into customer (first_name, last_name, company_id) 
values 
    ($1, $2, $3), 
    ($4, $5, $6) 
returning id
```

The parameters are: `[ "John", "Smith", 23, "Other", "Person", 23 ]`

The result type is a promise with the id of the last inserted rows:
```tsx
const insertMultipleCustomers: Promise<number[]>
```

## Manipulating values to insert

`ts-sql-query` offers many commodity methods to manipulate the data to insert, allowing adding missing values, deleting undesired values, or throwing an error if a value is present.

When you write your insert query, you set the initial value calling:

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
```

All these methods have a `When` variant that allows you to specify as the first argument a boolean that, when it is true, the action will be executed. Like: `setWhen(when: boolean, columns: InsertSets): this`

## Manipulating values to insert (multiple)

ts-sql-qeury offers many commodity methods to manipulate the data to insert, allowing adding missing values, deleting undesired values, or throwing an error if a value is present.

When you write your insert query, you set the initial value calling:

```ts
interface InsertExpression {
    values(columns: InsertSets[]): this
    dynamicValues(columns: OptionalInsertSets[]): this
}
```

The `values` method will require you to provide a value at least for the required fields. The `dynamicValues` method allows you to start the insert with optional values even when required in the insert; or even with no values at all. `ts-sql-query` will track all missing properties, and you will get a compilation error if one of them is missed (you will not be able to call the execute methods).

When you set the initial value, you can start manipulating them (all at the same time, with same new values) using the following methods:

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
```

All these methods have a `When` variant that allows you to specify as the first argument a boolean that, when it is true, the action will be executed. Like: `setForAll(columns: InsertSets): this`

## Insert on conflict do nothing

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
```sql
insert into customer (first_name, last_name, company_id) 
values ($1, $2, $3) 
on conflict do nothing 
returning id as id, first_name as firstName, last_name as lastName
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

## Insert on conflict do update ("upsert")

If you are using [PostgreSQL](../configuration/supported-databases/postgresql.md), [SQLite](../configuration/supported-databases/sqlite.md), [MariaDB](../configuration/supported-databases/mariadb.md) or [MySQL](../configuration/supported-databases/mysql.md) you can specify the insert must do an update in case of conflict. (This is also known as an "upsert".)

```ts
const insertReturningCustomerData = connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    })
    .onConflictDoUpdateSet({
        companyId: 1
    })
    .returning({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .executeInsertOne()
```

The executed query is:
```sql
insert into customer (first_name, last_name, company_id) 
values ($1, $2, $3) 
on conflict do update set 
    company_id = $4 
returning id as id, first_name as firstName, last_name as lastName
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

If you want to use in the update the values to insert you can call them method `valuesForInsert()` over the table to get access to the table representation of the values to insert.

```ts
const tCustomerForInsert = tCustomer.valuesForInsert()
const insertReturningCustomerData = await connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    })
    .onConflictDoUpdateSet({
        firstName: tCustomer.firstName.concat(' - ').concat(tCustomerForInsert.firstName),
        lastName: tCustomer.lastName.concat(' - ').concat(tCustomerForInsert.lastName)
    })
    .returning({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .executeInsertOne()
```

The executed query is:
```sql
insert into customer (first_name, last_name, company_id) 
values ($1, $2, $3) 
on conflict do update set 
    first_name = customer.first_name || $4 || excluded.first_name, 
    last_name = customer.last_name || $5 || excluded.last_name 
returning id as id, first_name as firstName, last_name as lastName
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

    - On [PostgreSQL](../configuration/supported-databases/postgresql.md) and [SQLite](../configuration/supported-databases/sqlite.md), you can specify a `where` clause that idicates when the update must be permormed.
    - On [PostgreSQL](../configuration/supported-databases/postgresql.md) and [SQLite](../configuration/supported-databases/sqlite.md), you can specify the columns that can create the conflict (including a `where` clause for that columns).
    - On [PostgreSQL](../configuration/supported-databases/postgresql.md) you can specify the constraint name that raise the conflict.
    - You can combine this with other insert's features, e.g. return some columns.
