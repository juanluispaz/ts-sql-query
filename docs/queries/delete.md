# Delete

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