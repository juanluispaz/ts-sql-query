# Delete

## General delete

```ts
const deleteCustomer = connection.deleteFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .executeDelete();
```

The executed query is:
```sql
delete from customer 
where id = $1
```

The parameters are: `[ 10 ]`

The result type is a promise with the number of deleted rows:
```tsx
const deleteCustomer: Promise<number>
```

**Security constraint**:

ts-sql-query will reject the execution of the delete sentence if, for some reason ended without a where. If you want to allow a delete without where, you must call `connection.deleteAllowingNoWhereFrom` instead of `connection.deleteFrom` when you start writing the sentence.

## Delete returning

If you are using `PostgreSql`, modern `Sqlite`, `SqlServer` or `Oracle`, you can return values of the deleted record in the same query using the `returning` or `returningOneColumn` methods.

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
```sql
delete from company 
where name = $1 
returning id as id, name as name
```

The parameters are: `[ 'ACME' ]`

The result type is a promise with the information of the deleted rows:
```tsx
const deletedAcmeCompany: Promise<{
    name: string;
    id: number;
}>
```

**Other options**

You can execute the query using:

- `executeDeleteNoneOrOne(): Promise<RESULT | null>`: Execute the delete query that returns one or no result from the database. In case of more than one result found, it throws and error with message 'Too many rows, expected only zero or one row'.
- `executeDeleteOne(): Promise<RESULT>`: Execute the delete query that returns one result from the database. If no result is returned by the database an exception will be thrown.
- `executeDeleteMany(min?: number, max?: number): Promise<RESULT[]>`: Execute the delete query that returns zero or many results from the database.

Aditionally, if you want to return the value of a single column, you can use `returningOneColumn(column)` instead of `returning({...})`.