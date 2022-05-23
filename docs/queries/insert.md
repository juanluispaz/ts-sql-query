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

## Insert on confict do nothing

If you are using `PostgreSql`, `Sqlite`, `MariaDB` or `MySql` you can specify the insert must do nothing in case of conflict.

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

**Notes**

- On `PostgreSql` and `Sqlite`, you can specify the columns that can create the conflict (including a `where` clause for that columns).
- On `PostgreSql` you can specify the constraint name that raise the conflict.
- You can combine this with other insert's features, e.g. return some columns.

## Insert on confict do update

If you are using `PostgreSql`, `Sqlite`, `MariaDB` or `MySql` you can specify the insert must do an update in case of conflict.

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

**Notes**

- On `PostgreSql` and `Sqlite`, you can specify `where` clause that idicates when the update must be permormed.
- On `PostgreSql` and `Sqlite`, you can specify the columns that can create the conflict (including a `where` clause for that columns).
- On `PostgreSql` you can specify the constraint name that raise the conflict.
- You can combine this with other insert's features, e.g. return some columns.