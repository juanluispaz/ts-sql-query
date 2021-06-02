# Update

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