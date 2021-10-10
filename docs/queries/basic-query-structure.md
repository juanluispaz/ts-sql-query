# Basic query structure

## Select one row

```ts
const customerId = 10;

const customerWithId = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(customerId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    })
    .executeSelectOne();
```

The executed query is:
```sql
select id as id, first_name as firstName, last_name as lastName, birthday as birthday 
from customer 
where id = $1
```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customerWithId: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
}>
```

The `executeSelectOne` returns one result, but if it is not found in the database an exception will be thrown. If you want to return the result when it is found or null when it is not found you must use the `executeSelectNoneOrOne` method.

## Other options

You can execute the query using:

- `executeSelectNoneOrOne(): Promise<RESULT | null>`: Execute the select query that returns one or no result from the database. In case of more than one result found, it throws and error with message 'Too many rows, expected only zero or one row'.
- `executeSelectOne(): Promise<RESULT>`: Execute the select query that returns one result from the database. If no result is returned by the database an exception will be thrown.
- `executeSelectMany(): Promise<RESULT[]>`: Execute the select query that returns zero or many results from the database
- `executeSelectPage(): Promise<{ data: RESULT[], count: number }>`: Execute the select query that returns zero or many results from the database. Select page execute the query twice, the first one to get the data from the database and the second one to get the count of all data without the limit and the offset.
- `executeSelectPage<EXTRAS extends {}>(extras: EXTRAS): Promise<{ data: RESULT[], count: number } & EXTRAS>`: Execute the select query as a select page, but allows to include extra properties to will be resulting object. If the object provided by argument includes the property count, the query that count the data will be omitted and this value will be used. If the object provided by argument includes the property data, the query that extract the data will be omitted and this value will be used.

Aditionally, if you want to return the value of a single column, you can use `selectOneColumn(column)` instead of `select({...})`.