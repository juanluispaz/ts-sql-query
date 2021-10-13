# Update

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

**Security constraint**:

ts-sql-query will reject the execution of the update sentence if, for some reason ended without a where. If you want to allow an update without where, you must call `connection.updateAllowingNoWhere` instead of `connection.update` when you start writing the sentence.

## Update returning

If you are using `PostgreSql`, modern `Sqlite`, `SqlServer` or `Oracle`, you can return updated values of the updated record in the same query using the `returning` or `returningOneColumn` methods.

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

You can execute the query using:

- `executeDeleteNoneOrOne(): Promise<RESULT | null>`: Execute the update query that returns one or no result from the database. In case of more than one result found, it throws and error with message 'Too many rows, expected only zero or one row'.
- `executeDeleteOne(): Promise<RESULT>`: Execute the update query that returns one result from the database. If no result is returned by the database an exception will be thrown.
- `executeDeleteMany(min?: number, max?: number): Promise<RESULT[]>`: Execute the update query that returns zero or many results from the database.

Aditionally, if you want to return the value of a single column, you can use `returningOneColumn(column)` instead of `returning({...})`.

## Update returning old values

If you are using `SqlServer` or `PostgreSql` (emulated in a single query, the table must have a primary key), you can return previous values of the updated record in the same query; to do this, you can create a reference to the old values of the table calling `myTable.oldValues()` and then use it in the returning clause.

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

Sometimes you want to include in the update query other tables or views to process the update instruction, you can add the `from` clause that is like a `from` clasue in a select. This is supported by `PostgreSql`, `Sqlite`, `SqlServer`, `MariaDB` or `MySql`.

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

The result type is a promise with the information of the deleted rows:
```tsx
const addACMECompanyNameToLastName: Promise<number>
```