# Transaction

## Hight-level transaction management

For simple transaction management, you can use the `transaction` method in the connection object. This method:

- begins the transaction before calling the function received by argument
- commits the transaction if the resulting promise returns a result
- rollbacks the transaction if the resulting promise returns an error

```ts
const transactionResult = connection.transaction(async () => {
    const companyId = await connection.insertInto ...
    const customerId = await connection.insertInto ...

    return {companyId, customerId};
});
```

The `transaction` method have two overloads:

- `transaction<T>(fn: () => Promise<T>[]): Promise<T[]>`
- `transaction<T>(fn: () => Promise<T>): Promise<T>`

## Low-level transaction management

Sometimes a fine-grain control over the transaction is required, in that situations ts-sql-query offer you the possibility to manually:

- begin the transaction

```ts
await connection.beginTransaction();
```

- commit the transaction

```ts
await connnection.commit();
```

- rollback the transaction

```ts
await connection.rollback();
```

When you use these methods, you must ensure the transaction begin before call commit or rollback.
