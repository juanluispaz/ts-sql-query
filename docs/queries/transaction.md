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

## Defering execution till transaction ends

You can defer the execution of a logic till the end of the transaction. This defered logic can be set calling the `executeAfterNextCommit` or `executeAfterNextRollback` of the ts-sql-query connection in any momment of the application execution; the only condition is there must be an active transaction.

```ts
connection.executeAfterNextCommit(() => {
    // Logic defered till the commit is executed
    console.log('After next commit')
})

connection.executeAfterNextRollback(() => {
    // Logic defered till the rollback is executed
    console.log('After next rollback')
})
```

**Note**: The provided function can be a sync function that returns void or an async function that returns a promise of void.