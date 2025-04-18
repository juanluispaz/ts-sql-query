---
search:
  boost: 3
---
# Select page

Select page execute the query twice, the first one to get the data from the database and the second one to get the count of all data without the limit and the offset.

```ts
const customerName = 'Smi'

const customerPageWithName = connection.selectFrom(tCustomer)
    .where(
        tCustomer.firstName.startsWithInsensitive(customerName)
    ).or(
        tCustomer.lastName.startsWithInsensitive(customerName)
    ).select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderBy('firstName')
    .orderBy('lastName')
    .limit(10)
    .offset(20)
    .executeSelectPage();
```

The executed query to get the data is:
```sql
select id as id, first_name as firstName, last_name as lastName 
from customer 
where first_name ilike ($1 || '%') 
    or last_name ilike ($2 || '%') 
order by firstName, lastName 
limit $3 
offset $4
```

And its parameters are: `[ 'Smi', 'Smi', 10, 20 ]`

The executed query to get the count is:
```sql
select count(*) 
from customer 
where first_name ilike ($1 || '%') 
    or last_name ilike ($2 || '%')
```

And its parameters are: `[ 'Smi', 'Smi' ]`

The result type is:
```tsx
const customerPageWithName: Promise<{
    data: {
        id: number;
        firstName: string;
        lastName: string;
    }[];
    count: number;
}>
```