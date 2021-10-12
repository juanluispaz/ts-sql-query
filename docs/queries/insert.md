# Insert

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

The result type is a promise with the id of the last inserted row:
```tsx
const insertMultipleCustomers: Promise<number[]>
```

**Note**: Return the last inserted id of an insert with multiple rows is only supported by **PostgreSql**, **SqlServer** and **Oracle**. If you try to use it with other database you will get a compilation error.

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

If you are using `PostgreSql`, modern `Sqlite`, `SqlServer` or `Oracle` (except for an insert from select), you can return values of the inserted record in the same query using the `returning` or `returningOneColumn` methods.

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

You can execute the query using:

- `executeInsertNoneOrOne(): Promise<RESULT | null>`: Execute the insert query that returns one or no result from the database. In case of more than one result found, it throws and error with message 'Too many rows, expected only zero or one row'.
- `executeInsertOne(): Promise<RESULT>`: Execute the insert query that returns one result from the database. If no result is returned by the database an exception will be thrown.
- `executeInsertMany(min?: number, max?: number): Promise<RESULT[]>`: Execute the insert query that returns zero or many results from the database.

Aditionally, if you want to return the value of a single column, you can use `returningOneColumn(column)` instead of `returning({...})`.